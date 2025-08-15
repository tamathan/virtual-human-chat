import { create } from 'zustand'
import type { ConnectionStatus, ChatMessage } from '../types'

export type MicState = 'idle' | 'connecting' | 'recording'
export type PlaybackState = 'idle' | 'playing'
export type RecordingState = boolean

export interface ChatState {
  connection: ConnectionStatus
  mic: MicState
  playback: PlaybackState
  recording: RecordingState
  history: ChatMessage[]
  token: string | null
  expiresAt: string | null
  error: string | null
}

export interface ChatActions {
  setConnection: (state: ConnectionStatus) => void
  setMic: (state: MicState) => void
  setPlayback: (state: PlaybackState) => void
  setRecording: (state: RecordingState) => void
  addMessage: (message: Omit<ChatMessage, 'timestamp'>) => void
  sendTextMessage: (text: string) => void
  setToken: (token: string | null, expiresAt?: string | null) => void
  setError: (error: string | null) => void
  clearHistory: () => void
  reset: () => void
}

const initialState: ChatState = {
  connection: 'disconnected',
  mic: 'idle',
  playback: 'idle',
  recording: false,
  history: [],
  token: null,
  expiresAt: null,
  error: null,
}

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  ...initialState,
  
  setConnection: (connection) => set({ connection }),
  setMic: (mic) => set({ mic }),
  setPlayback: (playback) => set({ playback }),
  setRecording: (recording) => set({ recording }),
  
  addMessage: (message) => set((state) => ({
    history: [...state.history, { ...message, timestamp: Date.now() }]
  })),
  
  sendTextMessage: (text) => set((state) => ({
    history: [...state.history, { 
      role: 'user' as const, 
      text, 
      messageType: 'text' as const,
      timestamp: Date.now() 
    }]
  })),
  
  setToken: (token, expiresAt = null) => set({ token, expiresAt }),
  setError: (error) => set({ error }),
  
  clearHistory: () => set({ history: [] }),
  
  reset: () => set(initialState),
}))