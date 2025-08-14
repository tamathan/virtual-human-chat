import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/store/chat-store'
import { AudioProcessor, AudioProcessorOptions, AudioStatus } from '@/lib/audio/audio-processor'
import { GeminiLiveAPIClientV2 } from '@/lib/gemini/live-api-client-v2'
import { TokenService } from '@/lib/api/token-service'

export function useVirtualHuman() {
  const {
    connection,
    mic,
    token,
    expiresAt,
    setConnection,
    setMic,
    setToken,
    setError,
    addMessage,
    sendTextMessage,
    clearHistory
  } = useChatStore()

  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const geminiClientRef = useRef<GeminiLiveAPIClientV2 | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected')
  const [reconnectInfo, setReconnectInfo] = useState({ attempts: 0, maxAttempts: 5, isReconnecting: false })
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({
    isSpeechActive: false,
    speechProbability: 0,
    bufferLevel: 0,
    isRecording: false,
    isStreaming: false
  })
  const [audioSettings, setAudioSettings] = useState<AudioProcessorOptions>({
    vadEnabled: true,
    vadThreshold: 0.01,
    streamingMode: true,
    chunkSize: 16384,
    enableNoiseReduction: true
  })

  // Initialize audio processor (delayed until user interaction)
  const initializeAudioWithUserGesture = async () => {
    if (audioProcessorRef.current) {
      console.log('Audio processor already initialized')
      return true
    }

    try {
      console.log('Initializing audio processor with user gesture...')
      
      // Check for browser support first
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('ブラウザが音声機能をサポートしていません - テキストモードのみ利用可能')
        return false
      }

      const processor = new AudioProcessor(
        (_audioData) => {
          // Audio data is now handled by the new client internally
          // The V2 client handles audio streaming directly
          console.log('Audio data received from processor')
        },
        (error) => {
          console.error('Audio processor error:', error)
          setError(`音声処理エラー: ${error.message}`)
        },
        (status) => {
          // Update audio status
          setAudioStatus(status)
        },
        audioSettings
      )

      await processor.initialize()
      audioProcessorRef.current = processor
      console.log('Audio processor initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize audio:', error)
      console.warn('音声初期化に失敗しましたが、接続は可能です:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }

  // Basic initialization without audio (only check browser compatibility)
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('Initializing application...')
        
        // Check browser compatibility
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('ブラウザが音声機能をサポートしていません - テキストモードのみ利用可能')
        }
        
        // Set initialized immediately (audio will be initialized on user gesture)
        setIsInitialized(true)
        console.log('Application initialized - connection available')
      } catch (error) {
        console.error('Failed to initialize application:', error)
        setIsInitialized(true) // Allow connection even if something failed
      }
    }

    initApp()
  }, [])

  // Connect to Gemini Live API
  const connect = async () => {
    if (connection === 'connecting' || connection === 'connected') return

    try {
      console.log('Starting connection to Gemini Live...')
      setConnection('connecting')
      setError(null)

      // Initialize audio on user gesture (if not already initialized)
      await initializeAudioWithUserGesture()

      // Get API key from environment
      console.log('Using direct API key for Gemini Live...')
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY not configured in environment variables')
      }

      // Create Gemini client with direct API key
      console.log('Creating Gemini Live API client...')
      const client = new GeminiLiveAPIClientV2(
        apiKey,
        (message) => {
          console.log('Received message from Gemini:', message.type)
          // Handle messages from Gemini
          if (message.type === 'text') {
            addMessage({
              role: 'assistant',
              text: message.content as string,
              messageType: 'text'
            })
          } else if (message.type === 'audio') {
            addMessage({
              role: 'assistant',
              text: '[音声応答]',
              messageType: 'audio',
              audioUrl: URL.createObjectURL(new Blob([message.content as ArrayBuffer], { type: 'audio/pcm' }))
            })
          }
        },
        (error) => {
          console.error('Gemini client error:', error)
          const errorMessage = TokenService.handleTokenError(error)
          setError(`接続エラー: ${errorMessage}`)
          
          // Update connection status
          updateConnectionStatus()
        },
        (connected) => {
          console.log('Connection status changed:', connected)
          setConnection(connected ? 'connected' : 'disconnected')
          updateConnectionStatus()
        }
      )

      console.log('Connecting to Gemini Live API...')
      await client.connect()
      geminiClientRef.current = client
      console.log('Successfully connected to Gemini Live!')
      updateConnectionStatus()

    } catch (error) {
      console.error('Connection failed:', error)
      const errorMessage = TokenService.handleTokenError(error)
      setError(`接続失敗: ${errorMessage}`)
      setConnection('disconnected')
      updateConnectionStatus()
    }
  }

  // Update connection status and reconnect info
  const updateConnectionStatus = () => {
    if (geminiClientRef.current) {
      setConnectionStatus(geminiClientRef.current.getConnectionStatus())
      setReconnectInfo(geminiClientRef.current.getReconnectInfo())
    }
  }

  // Disconnect
  const disconnect = () => {
    geminiClientRef.current?.disconnect()
    geminiClientRef.current = null
    setConnection('disconnected')
    setConnectionStatus('disconnected')
    setReconnectInfo({ attempts: 0, maxAttempts: 5, isReconnecting: false })
    setToken(null)
  }


  // Start/stop recording
  const toggleMic = async () => {
    // Check if Gemini client is connected first
    if (!geminiClientRef.current?.isWebSocketConnected()) {
      setError('Gemini APIに接続されていません。接続してから音声入力を開始してください。')
      return
    }

    if (mic === 'idle') {
      // Start recording using new client
      try {
        await geminiClientRef.current!.startRecording()
        setMic('recording')
        addMessage({
          role: 'user',
          text: '🎤 音声入力中...',
          messageType: 'audio'
        })
      } catch (error) {
        console.error('Failed to start recording:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(`録音開始に失敗しました: ${errorMessage}`)
      }
    } else {
      // Stop recording
      geminiClientRef.current!.stopRecording()
      setMic('idle')
    }
  }

  // Stop playback
  const stopPlayback = () => {
    geminiClientRef.current?.stopPlayback()
  }

  // Reset conversation
  const resetConversation = () => {
    clearHistory()
    stopPlayback()
    if (mic === 'recording') {
      audioProcessorRef.current?.stopRecording()
      setMic('idle')
    }
  }

  // Monitor connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateConnectionStatus()
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Check token expiration and connection health
  useEffect(() => {
    if (!token || !expiresAt) return

    const checkTokenAndConnection = () => {
      // Check token expiration
      if (TokenService.isTokenExpired(expiresAt)) {
        disconnect()
        setError('トークンが期限切れです。再接続してください。')
        return
      }

      // Auto-reconnect before expiration
      if (TokenService.isTokenExpiringSoon(expiresAt, 120000)) { // 2 minutes before expiration
        console.log('Token expiring soon, attempting to reconnect...')
        connect()
        return
      }

      // Check connection health
      if (geminiClientRef.current && !geminiClientRef.current.isWebSocketConnected() && connection === 'connected') {
        console.log('Connection status mismatch detected, updating...')
        setConnection('disconnected')
        updateConnectionStatus()
      }
    }

    const interval = setInterval(checkTokenAndConnection, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [token, expiresAt, connection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
      audioProcessorRef.current?.dispose()
    }
  }, [])

  // Audio settings control functions
  const updateAudioSettings = (newSettings: Partial<AudioProcessorOptions>) => {
    const updatedSettings = { ...audioSettings, ...newSettings }
    setAudioSettings(updatedSettings)
    
    // Apply settings to existing processor
    if (audioProcessorRef.current) {
      if (newSettings.vadEnabled !== undefined || newSettings.vadThreshold !== undefined) {
        audioProcessorRef.current.setVADSettings(
          newSettings.vadEnabled ?? updatedSettings.vadEnabled!,
          newSettings.vadThreshold ?? updatedSettings.vadThreshold
        )
      }
      
      if (newSettings.streamingMode !== undefined) {
        audioProcessorRef.current.setStreamingMode(newSettings.streamingMode)
      }
    }
  }

  // Enhanced mic control with better feedback
  const enhancedToggleMic = () => {
    if (!isInitialized || !audioProcessorRef.current) {
      setError('音声システムが初期化されていません')
      return
    }

    // Check if Gemini client is connected
    if (!geminiClientRef.current?.isWebSocketConnected()) {
      setError('Gemini APIに接続されていません。接続してから音声入力を開始してください。')
      return
    }

    if (mic === 'idle') {
      // Start recording with enhanced feedback
      audioProcessorRef.current.startRecording()
      setMic('recording')
      addMessage({
        role: 'user',
        text: audioSettings.vadEnabled ? 
          '🎤 音声入力中... (音声検出機能ON)' : 
          '🎤 音声入力中...'
      })
    } else {
      // Stop recording
      audioProcessorRef.current.stopRecording()
      setMic('idle')
      
      // Show final status
      if (audioStatus.isStreaming) {
        addMessage({
          role: 'user',
          text: '📡 音声データ送信完了'
        })
      }
    }
  }

  // Force send current audio buffer (useful for manual control)
  const flushAudioBuffer = () => {
    if (audioProcessorRef.current && mic === 'recording') {
      audioProcessorRef.current.stopRecording()
      audioProcessorRef.current.startRecording()
    }
  }

  // Get detailed audio diagnostics
  const getAudioDiagnostics = () => {
    return {
      audioStatus,
      audioSettings,
      isInitialized,
      processorStatus: audioProcessorRef.current?.getStatus(),
      connectionHealth: {
        isConnected: geminiClientRef.current?.isWebSocketConnected() || false,
        connectionStatus,
        reconnectInfo
      }
    }
  }

  // Send text message function
  const handleSendTextMessage = async (text: string) => {
    if (!text.trim()) return

    // Check if connected to Gemini
    if (!geminiClientRef.current?.isWebSocketConnected()) {
      setError('Gemini APIに接続されていません。接続してからテキストメッセージを送信してください。')
      return
    }

    try {
      // Add user message to chat history
      sendTextMessage(text)
      
      // Send to Gemini API via WebSocket
      if (geminiClientRef.current) {
        console.log('Sending text message to Gemini:', text)
        geminiClientRef.current.sendText(text)
      } else {
        setError('Gemini APIクライアントが初期化されていません')
      }
      
    } catch (error) {
      console.error('Failed to send text message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`テキストメッセージ送信に失敗しました: ${errorMessage}`)
    }
  }

  return {
    // Core functionality
    isInitialized,
    connect,
    disconnect,
    toggleMic: enhancedToggleMic, // Use enhanced version
    stopPlayback,
    resetConversation,
    
    // Text messaging
    sendTextMessage: handleSendTextMessage,
    
    // Connection status
    connectionStatus,
    reconnectInfo,
    isWebSocketConnected: () => geminiClientRef.current?.isWebSocketConnected() || false,
    
    // Audio status and controls
    audioStatus,
    audioSettings,
    updateAudioSettings,
    flushAudioBuffer,
    getAudioDiagnostics,
    
    // Backward compatibility
    toggleMicOriginal: toggleMic // Keep original name as alias
  }
}