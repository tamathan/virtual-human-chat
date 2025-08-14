// Token API types
export interface TokenResponse {
  token: string
  expiresAt: string
  expiresIn?: number
}

export interface TokenVerificationResponse {
  valid: boolean
  payload?: {
    jti: string
    purpose: string
    iat: number
    exp: number
    connectBefore: number
  }
  message: string
  error?: string
}

// Gemini Live API types
export interface GeminiConfig {
  websocketUrl: string
  model: string
  generationConfig?: {
    responseModalities: string[]
    speechConfig?: {
      voiceConfig?: {
        prebuiltVoiceConfig?: {
          voiceName: string
        }
      }
    }
  }
}

// Audio types
export interface AudioWorkletConfig {
  vadEnabled?: boolean
  vadThreshold?: number
  noiseGate?: number
  bufferSize?: number
  vadFrameSize?: number
  minSpeechFrames?: number
  minSilenceFrames?: number
  noiseFloor?: number
  noiseReduction?: number
  highPassAlpha?: number
  energyHistoryLength?: number
  reportInterval?: number
}

export interface AudioWorkletMessage {
  type: 'audio' | 'status' | 'vad' | 'error' | 'reset' | 'init' | 'configUpdated'
  data?: Float32Array
  isSpeech?: boolean
  energy?: number
  threshold?: number
  isSpeechActive?: boolean
  speechProbability?: number
  bufferLevel?: number
  errorCount?: number
  context?: string
  message?: string
  timestamp: number
  vadEnabled?: boolean
  vadThreshold?: number
  noiseGate?: number
}

// Chat types
export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  text?: string
  content?: string
  timestamp: number
  audioUrl?: string
  messageType?: 'audio' | 'text' | 'hybrid'
}

export interface ChatState {
  messages: ChatMessage[]
  isConnected: boolean
  isRecording: boolean
  isPlaying: boolean
  connectionStatus: ConnectionStatus
  error?: string
}

export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'error' 
  | 'reconnecting'

// Virtual Human state
export interface VirtualHumanState {
  connectionStatus: ConnectionStatus
  isRecording: boolean
  isPlaying: boolean
  audioLevel: number
  speechProbability: number
  error?: string
  lastActivity?: number
}

// API Error types
export interface ApiError extends Error {
  status?: number
  code?: string
  details?: any
}

// Environment types
export interface EnvironmentConfig {
  VITE_BFF_URL?: string
  NODE_ENV: 'development' | 'production' | 'test'
  GEMINI_API_KEY?: string
  JWT_SECRET?: string
  TOKEN_TTL_SEC?: string
  TOKEN_CONNECT_WINDOW_SEC?: string
  GCP_PROJECT_ID?: string
}