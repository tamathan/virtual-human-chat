import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/store/chat-store'
import { GeminiLiveAPIClientV3 } from '@/lib/gemini/live-api-client-v3'
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

  const geminiClientRef = useRef<GeminiLiveAPIClientV3 | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected')
  const [reconnectInfo, setReconnectInfo] = useState({ attempts: 0, maxAttempts: 5, isReconnecting: false })
  const [audioStatus] = useState({
    isSpeechActive: false,
    speechProbability: 0,
    bufferLevel: 0,
    isRecording: false,
    isStreaming: false
  })
  const [audioSettings, setAudioSettings] = useState({
    vadEnabled: true,
    vadThreshold: 0.01,
    streamingMode: true,
    chunkSize: 16384,
    enableNoiseReduction: true
  })

  // Audio initialization is now handled by the Gemini client directly  
  const initializeAudioWithUserGesture = async () => {
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('ブラウザが音声機能をサポートしていません - テキストモードのみ利用可能')
      return false
    }
    
    console.log('Audio capabilities confirmed - ready for connection')
    return true
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

      // Get API key securely from BFF
      console.log('Fetching secure API key from BFF...')
      
      // First get auth token
      let authToken = token
      if (!authToken) {
        console.log('No auth token found, requesting new token...')
        const tokenResponse = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        if (!tokenResponse.ok) {
          throw new Error('Failed to get authentication token')
        }
        const tokenData = await tokenResponse.json()
        authToken = tokenData.token
        setToken(authToken)
        console.log('Auth token obtained successfully')
      }

      // Get Gemini config with API key
      const configResponse = await fetch('/api/gemini/config', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      if (!configResponse.ok) {
        throw new Error('Failed to get Gemini configuration from BFF')
      }
      const geminiConfig = await configResponse.json()
      const apiKey = geminiConfig.apiKey
      console.log('Secure API key obtained from BFF')

      // Create Gemini client with direct API key
      console.log('Creating Gemini Live API client...')
      const client = new GeminiLiveAPIClientV3(
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
        setError(null) // Clear any previous errors
        console.log('Starting microphone recording...')
        
        await geminiClientRef.current!.startRecording()
        
        // setMic is handled by the client itself via useChatStore
        addMessage({
          role: 'user',
          text: '🎤 音声入力中...',
          messageType: 'audio'
        })
        
        console.log('Microphone recording started successfully')
      } catch (error) {
        console.error('Failed to start recording:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(`録音開始に失敗しました: ${errorMessage}`)
        setMic('idle') // Ensure mic state is reset on error
      }
    } else if (mic === 'recording' || mic === 'connecting') {
      // Stop recording
      console.log('Stopping microphone recording...')
      geminiClientRef.current!.stopRecording()
      // setMic is handled by the client itself via useChatStore
      
      addMessage({
        role: 'user', 
        text: '🔇 音声入力停止',
        messageType: 'audio'
      })
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
    if (mic === 'recording' || mic === 'connecting') {
      geminiClientRef.current?.stopRecording()
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
    }
  }, [])

  // Audio settings control functions
  const updateAudioSettings = (newSettings: any) => {
    const updatedSettings = { ...audioSettings, ...newSettings }
    setAudioSettings(updatedSettings)
    // V3 client handles audio processing internally
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
    toggleMic, // Use new V3 client version
    stopPlayback,
    resetConversation,
    
    // Text messaging
    sendTextMessage: handleSendTextMessage,
    
    // Connection status
    connectionStatus,
    reconnectInfo,
    isWebSocketConnected: () => geminiClientRef.current?.isWebSocketConnected() || false,
    
    // Audio status and controls (simplified for V3 client)
    audioStatus,
    audioSettings,
    updateAudioSettings
  }
}