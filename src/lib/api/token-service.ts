import type { TokenResponse, TokenVerificationResponse, GeminiConfig } from '../../types'

export class TokenService {
  private static readonly API_BASE = '/api'
  private static cachedToken: { token: string; expiresAt: string } | null = null
  private static cachedGeminiConfig: GeminiConfig | null = null

  static async getEphemeralToken(useCache: boolean = true): Promise<TokenResponse> {
    // Check if we have a valid cached token
    if (useCache && this.cachedToken && !this.isTokenExpired(this.cachedToken.expiresAt)) {
      // If token expires within 1 minute, refresh it
      if (!this.isTokenExpiringSoon(this.cachedToken.expiresAt, 60000)) {
        return this.cachedToken
      }
    }

    const response = await fetch(`${this.API_BASE}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Failed to get token: ${response.status} ${response.statusText}`
      )
    }

    const tokenData = await response.json()
    
    // Cache the token
    if (useCache) {
      this.cachedToken = tokenData
    }

    return tokenData
  }

  static async verifyToken(token: string): Promise<TokenVerificationResponse> {
    const response = await fetch(`${this.API_BASE}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.message || 'Token verification failed',
        error: errorData.error || 'Unknown error'
      }
    }

    return response.json()
  }

  static isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date()
  }

  static isTokenExpiringSoon(expiresAt: string, thresholdMs: number = 60000): boolean {
    return new Date(expiresAt).getTime() - Date.now() < thresholdMs
  }

  static async getGeminiConfig(token: string): Promise<GeminiConfig> {
    // Check cached config first
    if (this.cachedGeminiConfig) {
      return this.cachedGeminiConfig
    }

    const response = await fetch(`${this.API_BASE}/gemini/ws-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Failed to get Gemini config: ${response.status} ${response.statusText}`
      )
    }

    const config = await response.json()
    this.cachedGeminiConfig = config
    return config
  }

  static clearCachedToken(): void {
    this.cachedToken = null
    this.cachedGeminiConfig = null
  }

  static getCachedToken(): { token: string; expiresAt: string } | null {
    return this.cachedToken
  }

  static getCachedGeminiConfig(): GeminiConfig | null {
    return this.cachedGeminiConfig
  }

  // Error handling helper
  static handleTokenError(error: unknown): string {
    if (error instanceof Error) {
      // Rate limit error
      if (error.message.includes('429') || error.message.includes('Too many')) {
        return 'Rate limit exceeded. Please wait a moment and try again.'
      }
      // Server error
      if (error.message.includes('500')) {
        return 'Server error. Please try again later.'
      }
      // Network error
      if (error.message.includes('fetch')) {
        return 'Network error. Please check your connection and try again.'
      }
      return error.message
    }
    return 'An unexpected error occurred. Please try again.'
  }
}