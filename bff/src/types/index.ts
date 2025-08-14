// Token types
export interface EphemeralToken {
  token: string
  expiresAt: string
  expiresIn?: number
}

export interface TokenPayload {
  jti: string
  iat: number
  exp: number
  connectBefore: number
  purpose: string
  apiKey: string
  aud: string
  iss: string
}

export interface TokenInfo {
  isValid: boolean
  payload?: TokenPayload
  error?: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ErrorResponse {
  error: string
  message: string
  status?: number
  timestamp?: string
}

// Environment configuration
export interface ServerConfig {
  PORT: number
  NODE_ENV: 'development' | 'production' | 'test'
  JWT_SECRET: string
  GEMINI_API_KEY: string
  TOKEN_TTL_SEC: number
  TOKEN_CONNECT_WINDOW_SEC: number
  CORS_ORIGIN?: string
}

// Security types
export interface SecurityHeaders {
  'Content-Security-Policy': string
  'X-Frame-Options': string
  'X-Content-Type-Options': string
  'Referrer-Policy': string
  'Strict-Transport-Security': string
}