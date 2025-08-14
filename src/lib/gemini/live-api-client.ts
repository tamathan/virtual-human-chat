import { useChatStore } from '@/store/chat-store'

export interface GeminiMessage {
  type: 'audio' | 'text' | 'function_call' | 'function_response'
  content: string | ArrayBuffer
  role: 'user' | 'model'
}

export interface GeminiConfig {
  wsUrl: string
  config: {
    model: string
    sampleRate: number
    channels: number
    encoding: string
  }
}

export class GeminiLiveAPIClient {
  private ws: WebSocket | null = null
  private audioPlayer: HTMLAudioElement | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isReconnecting = false
  private isConnected = false
  private geminiConfig: GeminiConfig | null = null
  private activeAudioContexts = new Set<AudioContext>()
  private activeSources = new Set<AudioBufferSourceNode>()
  private connectionTimeout: number | null = null
  private heartbeatInterval: number | null = null

  constructor(
    private token: string,
    private onMessage: (message: GeminiMessage) => void,
    private onError: (error: Error) => void,
    private onStateChange: (connected: boolean) => void
  ) {}

  async connect(): Promise<void> {
    try {
      // Clear any existing connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
      }

      // Get secure WebSocket URL from BFF
      await this.getGeminiConfig()
      
      if (!this.geminiConfig) {
        throw new Error('Failed to get Gemini configuration')
      }

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close()
          this.onError(new Error('Connection timeout'))
        }
      }, 10000) // 10 second timeout

      this.ws = new WebSocket(this.geminiConfig.wsUrl)

      this.ws.onopen = () => {
        console.log('Connected to Gemini Live API')
        this.isConnected = true
        this.reconnectAttempts = 0
        this.onStateChange(true)
        this.sendSetupMessage()
        
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout)
          this.connectionTimeout = null
        }
        
        // Start heartbeat
        this.startHeartbeat()
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      this.ws.onclose = (event) => {
        console.log('Disconnected from Gemini Live API:', event.code, event.reason)
        this.isConnected = false
        this.onStateChange(false)
        this.stopHeartbeat()
        
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout)
          this.connectionTimeout = null
        }
        
        // Attempt reconnection if not intentional disconnect
        if (!this.isReconnecting && event.code !== 1000) {
          this.attemptReconnect()
        } else {
          this.cleanup()
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.onError(new Error('WebSocket connection error'))
        this.stopHeartbeat()
        
        if (!this.isReconnecting) {
          this.attemptReconnect()
        }
      }

    } catch (error) {
      this.onError(error as Error)
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        } catch (error) {
          console.error('Failed to send heartbeat:', error)
          this.attemptReconnect()
        }
      }
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private async getGeminiConfig(): Promise<void> {
    try {
      const apiBase = import.meta.env.VITE_BFF_URL ? `${import.meta.env.VITE_BFF_URL}/api` : '/api'
      const response = await fetch(`${apiBase}/gemini/ws-url`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please refresh your token.')
        }
        throw new Error(`Failed to get Gemini config: ${response.status} ${response.statusText}`)
      }

      const responseData = await response.json()
      // Transform the response to include default config if missing
      this.geminiConfig = {
        wsUrl: responseData.wsUrl,
        config: responseData.config || {
          model: 'gemini-2.0-flash-exp',
          sampleRate: 24000,
          channels: 1,
          encoding: 'linear16'
        }
      }
    } catch (error) {
      console.error('Failed to get Gemini config:', error)
      throw error
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.onError(new Error('Max reconnection attempts reached'))
      }
      return
    }

    this.isReconnecting = true
    this.reconnectAttempts++

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('Reconnection failed:', error)
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.onError(new Error('Max reconnection attempts reached'))
        }
      } finally {
        this.isReconnecting = false
      }
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)) // Exponential backoff
  }

  private sendSetupMessage(): void {
    if (!this.ws || !this.geminiConfig) return

    const setupMessage = {
      setup: {
        model: this.geminiConfig.config.model,
        generation_config: {
          response_modalities: ['AUDIO', 'TEXT'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: 'Charon'  // Japanese-optimized voice
              }
            }
          }
        },
        system_instruction: {
          parts: [
            {
              text: `あなたは親しみやすい日本語バーチャル会話AIアシスタントです。以下の特徴で会話してください：

1. 自然でテンポの良い日本語での対話
2. 親しみやすく丁寧な敬語を使用
3. 簡潔で分かりやすい回答を心がける
4. 必要に応じて詳細説明を提案
5. 相手の感情に配慮した対応
6. 音声対話に最適化された自然な話し方

音声形式設定：
- サンプルレート: ${this.geminiConfig.config.sampleRate}Hz
- チャンネル: モノラル（${this.geminiConfig.config.channels}ch）
- エンコーディング: ${this.geminiConfig.config.encoding}

常に日本語で応答し、音声による自然な会話を提供してください。`
            }
          ]
        }
      }
    }

    try {
      this.ws.send(JSON.stringify(setupMessage))
    } catch (error) {
      console.error('Failed to send setup message:', error)
      this.onError(new Error('Failed to initialize conversation'))
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      
      // Handle heartbeat response
      if (message.type === 'pong') {
        return
      }
      
      if (message.serverContent) {
        const content = message.serverContent
        
        if (content.modelTurn && content.modelTurn.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
              // Handle audio response
              const audioData = this.base64ToArrayBuffer(part.inlineData.data)
              this.queueAudioPlayback(audioData)
              
              this.onMessage({
                type: 'audio',
                content: audioData,
                role: 'model'
              })
            } else if (part.text) {
              // Handle text response
              this.onMessage({
                type: 'text',
                content: part.text,
                role: 'model'
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error)
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    try {
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes.buffer
    } catch (error) {
      console.error('Failed to decode base64 audio:', error)
      throw new Error('Invalid audio data received')
    }
  }

  private queueAudioPlayback(audioData: ArrayBuffer): void {
    this.audioQueue.push(audioData)
    if (!this.isPlaying) {
      this.playNextAudio()
    }
  }

  private async playNextAudio(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false
      useChatStore.getState().setPlayback('idle')
      return
    }

    this.isPlaying = true
    useChatStore.getState().setPlayback('playing')

    const audioData = this.audioQueue.shift()!
    
    try {
      // Create new AudioContext for each playback to avoid memory leaks
      const audioContext = new AudioContext({ sampleRate: 24000 })
      this.activeAudioContexts.add(audioContext)
      
      const audioBuffer = await this.pcmToAudioBuffer(audioData, audioContext)
      
      // Use enhanced audio source with processing chain
      const source = this.createAudioSource(audioBuffer, audioContext)
      this.activeSources.add(source)
      
      source.onended = () => {
        // Clean up resources
        this.activeSources.delete(source)
        this.activeAudioContexts.delete(audioContext)
        
        // Close audio context to free memory
        audioContext.close().catch(console.error)
        
        // Play next audio
        this.playNextAudio()
      }
      
      source.start()
    } catch (error) {
      console.error('Error playing audio:', error)
      this.playNextAudio()
    }
  }

  private async pcmToAudioBuffer(pcmData: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
    // Use configured sample rate or default to 24kHz (Gemini's output rate)
    const sampleRate = this.geminiConfig?.config.sampleRate || 24000
    const numberOfChannels = 1
    const length = pcmData.byteLength / 2 // 16-bit samples
    
    const audioBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate)
    const channelData = audioBuffer.getChannelData(0)
    
    const int16Array = new Int16Array(pcmData)
    for (let i = 0; i < int16Array.length; i++) {
      // Convert from 16-bit signed integer to float32 [-1, 1]
      channelData[i] = int16Array[i] / 32768
    }
    
    return audioBuffer
  }

  // Enhanced audio playback with quality improvements and proper cleanup
  private createAudioSource(audioBuffer: AudioBuffer, audioContext: AudioContext): AudioBufferSourceNode {
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    
    // Add some audio processing for better quality
    const gainNode = audioContext.createGain()
    const compressor = audioContext.createDynamicsCompressor()
    
    // Set up audio processing chain: source -> compressor -> gain -> destination
    source.connect(compressor)
    compressor.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Configure compressor for better speech clarity
    compressor.threshold.setValueAtTime(-24, audioContext.currentTime)
    compressor.knee.setValueAtTime(30, audioContext.currentTime)
    compressor.ratio.setValueAtTime(12, audioContext.currentTime)
    compressor.attack.setValueAtTime(0.003, audioContext.currentTime)
    compressor.release.setValueAtTime(0.25, audioContext.currentTime)
    
    // Set initial gain (can be adjusted for volume control)
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime)
    
    return source
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected')
      // Try to reconnect if not already attempting
      if (!this.isReconnecting) {
        this.attemptReconnect()
      }
      return
    }

    // Stop current playback (barge-in)
    this.stopPlayback()

    try {
      const base64Audio = this.arrayBufferToBase64(audioData)
      
      // Use configured encoding format
      const mimeType = this.geminiConfig?.config.encoding === 'linear16' ? 
        'audio/pcm' : `audio/${this.geminiConfig?.config.encoding || 'pcm'}`
      
      const message = {
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio
                  }
                }
              ]
            }
          ],
          turn_complete: true
        }
      }

      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error sending audio:', error)
      this.onError(new Error('Failed to send audio data'))
      if (!this.isReconnecting) {
        this.attemptReconnect()
      }
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    try {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    } catch (error) {
      console.error('Failed to encode audio to base64:', error)
      throw new Error('Failed to encode audio data')
    }
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected')
      // Try to reconnect if not already attempting
      if (!this.isReconnecting) {
        this.attemptReconnect()
      }
      return
    }

    // Stop current playback (barge-in)
    this.stopPlayback()

    try {
      const message = {
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: text
                }
              ]
            }
          ],
          turn_complete: true
        }
      }

      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error sending text:', error)
      this.onError(new Error('Failed to send text message'))
      if (!this.isReconnecting) {
        this.attemptReconnect()
      }
    }
  }

  stopPlayback(): void {
    this.audioQueue = []
    this.isPlaying = false
    useChatStore.getState().setPlayback('idle')
    
    // Stop all active audio sources
    this.activeSources.forEach(source => {
      try {
        source.stop()
      } catch (error) {
        // Source might already be stopped
      }
    })
    this.activeSources.clear()
    
    // Close all active audio contexts
    this.activeAudioContexts.forEach(context => {
      context.close().catch(console.error)
    })
    this.activeAudioContexts.clear()
    
    if (this.audioPlayer) {
      this.audioPlayer.pause()
      this.audioPlayer.currentTime = 0
    }
  }

  disconnect(): void {
    this.isReconnecting = false // Prevent automatic reconnection
    this.stopHeartbeat()
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting') // Normal closure
    }
    this.cleanup()
  }

  private cleanup(): void {
    this.ws = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.isReconnecting = false
    this.stopPlayback()
    this.stopHeartbeat()
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    this.audioPlayer = null
    this.geminiConfig = null
  }

  // Public methods for status checking
  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  getConnectionStatus(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'connected'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'disconnected'
      default: return 'unknown'
    }
  }

  getReconnectInfo(): { attempts: number; maxAttempts: number; isReconnecting: boolean } {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      isReconnecting: this.isReconnecting
    }
  }

  // Enhanced resource monitoring
  getResourceUsage(): { activeContexts: number; activeSources: number; queueLength: number } {
    return {
      activeContexts: this.activeAudioContexts.size,
      activeSources: this.activeSources.size,
      queueLength: this.audioQueue.length
    }
  }
}