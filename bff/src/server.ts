import express, { Request } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { TokenService } from './services/token-service.js'
import { logger } from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss://generativelanguage.googleapis.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  } : false, // Disable for development
  crossOriginEmbedderPolicy: false, // Allow for WebSocket connections
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// Enhanced CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  : [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000']

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true)
    }
    
    if (!origin) {
      return callback(new Error('Not allowed by CORS'), false)
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    logger.warn({
      action: 'cors_violation',
      origin,
      allowedOrigins,
      ip: origin
    })
    
    return callback(new Error('Not allowed by CORS'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // For legacy browser support
  maxAge: 86400 // 24 hours preflight cache
}))

// Enhanced rate limiting with different tiers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Stricter in production
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator for better tracking
  keyGenerator: (req: Request) => {
    return req.ip + ':' + (req.get('User-Agent') || 'unknown')
  },
  // Skip successful requests for better UX
  skipSuccessfulRequests: false,
  // Store rate limit info
  handler: (req: Request, res, next) => {
    logger.warn({
      action: 'rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    })
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    })
  }
})
app.use(limiter)

// Token endpoint rate limiting (stricter)
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 3 : 10, // Very strict in production
  message: {
    error: 'Too many token requests',
    message: 'Too many token requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res, next) => {
    logger.warn({
      action: 'token_rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    })
    res.status(429).json({
      error: 'Too many token requests',
      message: 'Too many token requests, please try again later.',
      retryAfter: 60
    })
  }
})

// Body parsing with size limits
app.use(express.json({ 
  limit: '1mb',
  verify: (req: Request, res, body, encoding) => {
    // Log large payloads
    if (body.length > 100000) { // 100KB
      logger.warn({
        action: 'large_payload',
        size: body.length,
        ip: req.ip,
        path: req.path
      })
    }
  }
}))

// Request logging middleware with security headers
app.use((req, res, next) => {
  const start = Date.now()
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latency_ms: duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString()
    })
  })
  next()
})

// Health check endpoint with enhanced information
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  }
  
  res.json(healthStatus)
})

// Authentication endpoints
app.post('/api/auth/token', tokenLimiter, async (req, res) => {
  try {
    const tokenData = await TokenService.generateEphemeralToken()
    
    logger.info({
      action: 'token_generated',
      expiresAt: tokenData.expiresAt,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    res.json(tokenData)
  } catch (error) {
    logger.error({
      action: 'token_generation_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    // Don't expose internal error details in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(500).json({
      error: 'Failed to generate token',
      message
    })
  }
})

// Token verification endpoint (for debugging - remove in production)
app.post('/api/auth/verify', TokenService.authenticateToken, (req, res) => {
  const user = (req as any).user
  
  logger.info({
    action: 'token_verified',
    tokenId: user?.jti,
    purpose: user?.purpose,
    ip: req.ip
  })
  
  res.json({
    valid: true,
    payload: {
      jti: user.jti,
      purpose: user.purpose,
      iat: user.iat,
      exp: user.exp,
      connectBefore: user.connectBefore
    },
    message: 'Token is valid'
  })
})

// Legacy token endpoint (backward compatibility - consider removing)
app.post('/api/token', tokenLimiter, async (req, res) => {
  try {
    const tokenData = await TokenService.generateEphemeralToken()
    
    logger.info({
      action: 'legacy_token_generated',
      expiresAt: tokenData.expiresAt,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    res.json(tokenData)
  } catch (error) {
    logger.error({
      action: 'legacy_token_generation_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    })
    
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(500).json({
      error: 'Failed to generate token',
      message
    })
  }
})

// Gemini Live API proxy endpoint with enhanced security
app.get('/api/gemini/ws-url', TokenService.authenticateToken, (req, res) => {
  try {
    const user = (req as any).user
    const apiKey = user.apiKey
    
    if (!apiKey) {
      logger.error({
        action: 'missing_api_key',
        tokenId: user.jti,
        ip: req.ip
      })
      
      return res.status(500).json({
        error: 'API key not available',
        message: 'No API key found in token'
      })
    }

    // Validate API key format (basic check)
    if (!apiKey.startsWith('AIza') || apiKey.length < 39) {
      logger.error({
        action: 'invalid_api_key_format',
        tokenId: user.jti,
        ip: req.ip
      })
      
      return res.status(500).json({
        error: 'Invalid API key',
        message: 'API key format is invalid'
      })
    }

    // Generate secure WebSocket URL
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.StreamGenerateContent?key=${apiKey}`
    
    logger.info({
      action: 'gemini_ws_url_generated',
      tokenId: user.jti,
      ip: req.ip
    })
    
    res.json({
      wsUrl,
      config: {
        model: 'models/gemini-2.0-flash-exp',
        sampleRate: 16000,
        channels: 1,
        encoding: 'linear16'
      }
    })
  } catch (error) {
    logger.error({
      action: 'gemini_ws_url_generation_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    })
    
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(500).json({
      error: 'Failed to generate WebSocket URL',
      message
    })
  }
})

// **CRITICAL FIX: Static file serving for React app**
const staticPath = path.join(__dirname, '..', 'dist')
app.use(express.static(staticPath, {
  etag: true,
  maxAge: '1d', // Cache for 1 day in production
  setHeaders: (res, filePath) => {
    // Set correct MIME types for different file types
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    } else if (filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
    } else if (filePath.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2')
    } else if (filePath.endsWith('.woff')) {
      res.setHeader('Content-Type', 'font/woff')
    } else if (filePath.endsWith('.ttf')) {
      res.setHeader('Content-Type', 'font/ttf')
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml')
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png')
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg')
    }
    
    // Set caching headers
    if (process.env.NODE_ENV === 'production') {
      if (filePath.includes('/assets/')) {
        // Aggressive caching for hashed assets
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        // Normal caching for other static files
        res.setHeader('Cache-Control', 'public, max-age=86400')
      }
    }
  }
}))

// **CRITICAL FIX: SPA fallback route (must be AFTER static files but BEFORE error handlers)**
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return res.status(404).json({
      error: 'Not found',
      message: `API route ${req.originalUrl} not found`
    })
  }
  
  // Serve React app for all other routes
  const indexPath = path.join(staticPath, 'index.html')
  logger.info({
    action: 'spa_fallback',
    path: req.originalUrl,
    indexPath,
    ip: req.ip
  })
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error({
        action: 'spa_fallback_failed',
        error: err.message,
        path: req.originalUrl,
        indexPath,
        ip: req.ip
      })
      res.status(500).json({
        error: 'Failed to load application',
        message: 'Could not serve React application'
      })
    }
  })
})

// Error handling middleware with enhanced logging
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  })
  
  // Don't expose stack traces in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong' 
    : error.message
  
  res.status(500).json({
    error: 'Internal server error',
    message
  })
})

// Graceful shutdown
const server = app.listen(PORT, () => {
  logger.info({
    action: 'server_started',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    staticPath,
    timestamp: new Date().toISOString()
  })
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📁 Serving static files from: ${staticPath}`)
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info({ action: 'server_shutdown_initiated', signal: 'SIGTERM' })
  server.close(() => {
    logger.info({ action: 'server_shutdown_complete' })
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info({ action: 'server_shutdown_initiated', signal: 'SIGINT' })
  server.close(() => {
    logger.info({ action: 'server_shutdown_complete' })
    process.exit(0)
  })
})