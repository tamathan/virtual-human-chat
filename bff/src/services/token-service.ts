import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import type { EphemeralToken, TokenPayload, TokenInfo } from '../types'

export class TokenService {
  private static readonly TOKEN_TTL_SEC = parseInt(process.env.TOKEN_TTL_SEC || '900') // 15 minutes
  private static readonly CONNECT_WINDOW_SEC = parseInt(process.env.TOKEN_CONNECT_WINDOW_SEC || '60') // 1 minute to connect
  private static readonly SECRET = TokenService.getJWTSecret()
  private static readonly GEMINI_API_KEY = process.env.GEMINI_API_KEY

  // Enhanced JWT Secret validation and generation
  private static getJWTSecret(): string {
    const secret = process.env.JWT_SECRET
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    
    // Validate secret strength
    if (secret.length < 32) {
      console.warn('⚠️  JWT_SECRET is too short. Recommended minimum: 32 characters')
    }
    
    if (secret === 'development-secret-key' && process.env.NODE_ENV === 'production') {
      throw new Error('Cannot use default JWT_SECRET in production environment')
    }
    
    return secret
  }

  // Generate cryptographically secure secret for production
  static generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex')
  }

  static async generateEphemeralToken(): Promise<EphemeralToken> {
    if (!this.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const now = Date.now()
    const expiresAt = new Date(now + this.TOKEN_TTL_SEC * 1000)
    const connectWindow = new Date(now + this.CONNECT_WINDOW_SEC * 1000)

    const payload = {
      jti: uuidv4(), // Unique token ID
      iat: Math.floor(now / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      connectBefore: Math.floor(connectWindow.getTime() / 1000),
      purpose: 'gemini-live-api',
      apiKey: this.GEMINI_API_KEY,
      // Add additional security claims
      aud: 'virtual-human-chat',
      iss: 'bff-service'
    }

    const token = jwt.sign(payload, this.SECRET, {
      algorithm: 'HS256',
      notBefore: 0 // Token is valid immediately
    })

    return {
      token,
      expiresAt: expiresAt.toISOString()
    }
  }

  static verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: ['HS256'], // Explicitly specify allowed algorithms
        audience: 'virtual-human-chat',
        issuer: 'bff-service'
      })
      
      // Additional validation
      if (typeof decoded === 'object' && decoded !== null) {
        const payload = decoded as TokenPayload
        const now = Math.floor(Date.now() / 1000)
        
        // Check if token is expired
        if (payload.exp && now > payload.exp) {
          throw new Error('Token has expired')
        }
        
        // Check if token purpose matches
        if (payload.purpose !== 'gemini-live-api') {
          throw new Error('Invalid token purpose')
        }
        
        return payload
      }
      
      throw new Error('Invalid token format')
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Token verification failed: ${error.message}`)
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired')
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('Token not yet valid')
      }
      throw error
    }
  }

  static extractApiKey(token: string): string {
    const decoded = this.verifyToken(token)
    
    // Check if token is within connect window
    const now = Math.floor(Date.now() / 1000)
    if (decoded.connectBefore && now > decoded.connectBefore) {
      throw new Error('Token connect window expired')
    }

    if (!decoded.apiKey) {
      throw new Error('API key not found in token')
    }

    return decoded.apiKey
  }

  // Authentication middleware for protected routes
  static authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null

    if (!token) {
      res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      })
      return
    }

    try {
      const decoded = TokenService.verifyToken(token)
      
      // Additional security checks
      if (!decoded.jti) {
        throw new Error('Token missing unique identifier')
      }
      
      // Attach decoded token to request for use in route handlers
      ;(req as any).user = decoded
      next()
    } catch (error) {
      // Log security events (but don't expose internal details)
      console.error('Token authentication failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      })
      
      res.status(403).json({
        error: 'Invalid token',
        message: 'Token validation failed'
      })
    }
  }

  // Get token info without full validation (for debugging/monitoring)
  static getTokenInfo(token: string): TokenInfo {
    try {
      const decoded = jwt.decode(token)
      const verified = this.verifyToken(token)
      return { isValid: true, payload: verified }
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Enhanced security: Token revocation check (placeholder for future implementation)
  static async isTokenRevoked(jti: string): Promise<boolean> {
    // TODO: Implement token revocation list (Redis/database)
    // This would check if token has been explicitly revoked
    return false
  }

  // Security utility: Rate limiting by token
  static createTokenRateLimit(): any {
    // Return a rate limiter that tracks by token JTI
    const rateLimit = require('express-rate-limit')
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute per token
      keyGenerator: (req: Request) => {
        const user = (req as any).user
        return user?.jti || req.ip
      },
      message: 'Too many requests with this token'
    })
  }
}