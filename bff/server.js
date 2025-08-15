import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for Cloud Run (use number instead of true)
app.set('trust proxy', 1);

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const TOKEN_TTL_SEC = parseInt(process.env.TOKEN_TTL_SEC || '1800');
const TOKEN_CONNECT_WINDOW_SEC = parseInt(process.env.TOKEN_CONNECT_WINDOW_SEC || '60');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Debug environment variables at startup
console.log('[DEBUG] Environment variables status:');
console.log('[DEBUG] GEMINI_API_KEY:', GEMINI_API_KEY ? `Set (${GEMINI_API_KEY.substring(0, 10)}...)` : 'NOT SET');
console.log('[DEBUG] JWT_SECRET:', JWT_SECRET ? 'Set' : 'NOT SET');
console.log('[DEBUG] NODE_ENV:', NODE_ENV);
console.log('[DEBUG] TOKEN_TTL_SEC:', TOKEN_TTL_SEC);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss://generativelanguage.googleapis.com", "https://*.web.app", "https://*.cloudfunctions.net", "https://*.run.app"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting with proper trust proxy configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1 // Trust first proxy (Cloud Run)
});
app.use(limiter);

// Token rate limiting
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: NODE_ENV === 'production' ? 3 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1 // Trust first proxy (Cloud Run)
});

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Static files serving with proper MIME types and caching
const staticPath = path.join(__dirname, 'dist');
app.use(express.static(staticPath, {
  maxAge: NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Set proper MIME types
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    }

    // Security headers for static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Immutable caching for hashed assets
    if (filePath.includes('assets/') && NODE_ENV === 'production') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Logger
const logger = {
  info: (data) => console.log('[INFO]', JSON.stringify(data)),
  warn: (data) => console.warn('[WARN]', JSON.stringify(data)),
  error: (data) => console.error('[ERROR]', JSON.stringify(data))
};

// Token service
class TokenService {
  static generateEphemeralToken(purpose = 'gemini-access') {
    const payload = {
      id: uuidv4(),
      jti: uuidv4(),
      purpose,
      timestamp: Date.now()
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SEC });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = TokenService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.post('/api/auth/token', tokenLimiter, (req, res) => {
  try {
    const token = TokenService.generateEphemeralToken('gemini-access');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SEC * 1000).toISOString();
    logger.info({
      action: 'token_generated',
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    res.json({ token, expiresIn: TOKEN_TTL_SEC, expiresAt });
  } catch (error) {
    logger.error({ action: 'token_generation_failed', error: error.message });
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.post('/api/token', tokenLimiter, (req, res) => {
  try {
    const token = TokenService.generateEphemeralToken('gemini-access');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SEC * 1000).toISOString();
    res.json({ token, expiresIn: TOKEN_TTL_SEC, expiresAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Verify token endpoint
app.post('/api/auth/verify', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ valid: false, message: 'No token provided', error: 'unauthorized' });
    }

    const decoded = TokenService.verifyToken(token);

    const nowSec = Math.floor(Date.now() / 1000);
    const iat = decoded.iat || nowSec;
    const exp = decoded.exp || nowSec + TOKEN_TTL_SEC;
    const connectBefore = new Date((exp - TOKEN_CONNECT_WINDOW_SEC) * 1000).toISOString();

    return res.json({
      valid: true,
      payload: {
        jti: decoded.jti || decoded.id,
        purpose: decoded.purpose || 'gemini-access',
        iat,
        exp,
        connectBefore,
      },
      message: 'Token is valid'
    });
  } catch (error) {
    return res.status(403).json({ valid: false, message: 'Invalid token', error: 'forbidden' });
  }
});

app.get('/api/gemini/ws-url', TokenService.authenticateToken, (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  
  logger.info({
    action: 'gemini_ws_url_provided',
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  res.json({ wsUrl });
});

// Secure Gemini API key endpoint for JavaScript SDK
app.get('/api/gemini/config', TokenService.authenticateToken, (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  logger.info({
    action: 'gemini_config_provided',
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  // Return securely proxied API key for authenticated requests only
  res.json({ 
    apiKey: GEMINI_API_KEY,
    model: 'gemini-2.5-flash-preview-native-audio-dialog',
    region: 'us-central1'
  });
});

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // Don't cache the main index.html to ensure fresh deployments
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const indexPath = path.join(staticPath, 'index.html');
  logger.info({
    action: 'spa_fallback',
    path: req.path,
    indexPath,
    staticPath
  });
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error({
        action: 'spa_fallback_error',
        error: err.message,
        indexPath,
        staticPath,
        __dirname
      });
      res.status(500).json({ error: 'Could not load app' });
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info({
    action: 'server_started',
    port: PORT,
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});
