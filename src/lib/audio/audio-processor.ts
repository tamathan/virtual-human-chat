import type { AudioWorkletConfig } from '../../types'

export interface AudioProcessorOptions extends AudioWorkletConfig {
  streamingMode?: boolean
  chunkSize?: number
  enableNoiseReduction?: boolean
}

export interface AudioStatus {
  isSpeechActive: boolean
  speechProbability: number
  bufferLevel: number
  isRecording: boolean
  isStreaming: boolean
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: AudioWorkletNode | null = null
  private isRecording = false
  private audioQueue: Float32Array[] = []
  private streamingMode = false
  private streamingBuffer: Float32Array[] = []
  private streamingChunkSize = 16384 // 1024ms at 16kHz
  private lastSentTime = 0
  private minStreamingInterval = 100 // Minimum 100ms between sends
  private options: AudioProcessorOptions
  private status: AudioStatus = {
    isSpeechActive: false,
    speechProbability: 0,
    bufferLevel: 0,
    isRecording: false,
    isStreaming: false
  }

  constructor(
    private onAudioData: (audioData: ArrayBuffer) => void,
    private onError: (error: Error) => void,
    private onStatusUpdate?: (status: AudioStatus) => void,
    options: AudioProcessorOptions = {}
  ) {
    this.options = {
      vadEnabled: true,
      vadThreshold: 0.01,
      streamingMode: true,
      chunkSize: 16384,
      enableNoiseReduction: true,
      ...options
    }
    this.streamingMode = this.options.streamingMode || false
    this.streamingChunkSize = this.options.chunkSize || 16384
  }

  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      
      // Load audio worklet (bundled by Vite via relative URL)
      // Use a relative URL so it works in dev and production builds
      console.log('Loading audio worklet module...')
      await this.audioContext.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url))
      console.log('Audio worklet module loaded successfully')
      
      // Get user media with enhanced settings
      console.log('Requesting microphone access...')
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: this.options.enableNoiseReduction,
          noiseSuppression: this.options.enableNoiseReduction,
          autoGainControl: this.options.enableNoiseReduction
        }
      })
      console.log('Microphone access granted')

      // Create audio nodes
      console.log('Creating audio worklet node...')
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.processorNode = new AudioWorkletNode(
        this.audioContext, 
        'audio-recorder-processor',
        {
          processorOptions: {
            vadEnabled: this.options.vadEnabled,
            vadThreshold: this.options.vadThreshold,
          }
        }
      )
      console.log('Audio worklet node created successfully')
      
      // Set up message handling first
      this.processorNode.port.onmessage = (event) => {
        this.handleWorkletMessage(event.data)
      }
      
      // Wait for worklet initialization confirmation
      await this.waitForWorkletInit()
      
      // Connect nodes
      this.sourceNode.connect(this.processorNode)
      this.processorNode.connect(this.audioContext.destination)
      console.log('Audio nodes connected successfully')

    } catch (error) {
      console.error('Audio initialization failed:', error)
      this.onError(error as Error)
    }
  }

  private async waitForWorkletInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio worklet initialization timeout'))
      }, 3000) // 3 second timeout

      // Listen for init message from worklet
      const originalHandler = this.processorNode?.port.onmessage
      
      if (this.processorNode) {
        this.processorNode.port.onmessage = (event) => {
          if (event.data?.type === 'init') {
            console.log('Audio worklet initialized:', event.data.message)
            clearTimeout(timeout)
            // Restore original handler
            if (this.processorNode && originalHandler) {
              this.processorNode.port.onmessage = originalHandler
            }
            resolve()
          } else if (originalHandler && this.processorNode) {
            // Forward other messages to original handler
            originalHandler.call(this.processorNode.port, event)
          }
        }
      } else {
        reject(new Error('Processor node not available'))
      }
    })
  }

  private handleWorkletMessage(message: any): void {
    switch (message.type) {
      case 'init':
        console.log('Audio worklet processor ready:', message.message)
        break
        
      case 'audio':
        if (this.isRecording) {
          this.handleAudioData(message.data, message.isSpeech, message.energy)
        }
        break
        
      case 'vad':
        this.status.isSpeechActive = message.isSpeech
        this.updateStatus()
        break
        
      case 'status':
        this.status.isSpeechActive = message.isSpeechActive
        this.status.speechProbability = message.speechProbability
        this.status.bufferLevel = message.bufferLevel
        this.updateStatus()
        break
        
      case 'error':
        console.error('Audio worklet error:', message.context, message.message)
        break
        
      default:
        console.log('Unknown worklet message:', message)
        break
    }
  }

  private handleAudioData(audioData: Float32Array, isSpeech: boolean, _energy: number): void {
    if (this.streamingMode) {
      this.handleStreamingAudio(audioData, isSpeech)
    } else {
      this.audioQueue.push(audioData)
      this.flushAudioQueue()
    }
  }

  private handleStreamingAudio(audioData: Float32Array, isSpeech: boolean): void {
    this.streamingBuffer.push(audioData)
    
    // Calculate current buffer size
    const currentBufferSize = this.streamingBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
    
    // Check if we should send data based on speech activity and buffer size
    const shouldSend = 
      (isSpeech && currentBufferSize >= this.streamingChunkSize / 4) || // Send smaller chunks during speech
      (!isSpeech && currentBufferSize >= this.streamingChunkSize) ||      // Send larger chunks during silence
      (Date.now() - this.lastSentTime > 1000) // Force send after 1 second

    // Respect minimum interval to avoid overwhelming the API
    const timeSinceLastSent = Date.now() - this.lastSentTime
    
    if (shouldSend && timeSinceLastSent >= this.minStreamingInterval) {
      this.flushStreamingBuffer()
    }
  }

  private flushStreamingBuffer(): void {
    if (this.streamingBuffer.length === 0) return

    // Concatenate streaming buffer chunks
    const totalLength = this.streamingBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
    const combinedArray = new Float32Array(totalLength)
    
    let offset = 0
    for (const chunk of this.streamingBuffer) {
      combinedArray.set(chunk, offset)
      offset += chunk.length
    }

    // Convert to 16-bit PCM and send
    const pcmData = this.floatTo16BitPCM(combinedArray)
    this.onAudioData(pcmData.buffer as ArrayBuffer)
    
    // Clear streaming buffer and update timestamp
    this.streamingBuffer = []
    this.lastSentTime = Date.now()
    this.status.isStreaming = true
    this.updateStatus()
  }

  private flushAudioQueue(): void {
    if (this.audioQueue.length === 0) return

    // Concatenate audio chunks
    const totalLength = this.audioQueue.reduce((sum, chunk) => sum + chunk.length, 0)
    const combinedArray = new Float32Array(totalLength)
    
    let offset = 0
    for (const chunk of this.audioQueue) {
      combinedArray.set(chunk, offset)
      offset += chunk.length
    }

    // Convert to 16-bit PCM
    const pcmData = this.floatTo16BitPCM(combinedArray)
    this.onAudioData(pcmData.buffer as ArrayBuffer)
    
    // Clear queue
    this.audioQueue = []
  }

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    }
    return int16Array
  }

  startRecording(): void {
    if (!this.audioContext || !this.processorNode) {
      this.onError(new Error('Audio processor not initialized'))
      return
    }
    
    this.isRecording = true
    this.status.isRecording = true
    this.status.isStreaming = false
    this.lastSentTime = Date.now()
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
    
    this.updateStatus()
  }

  stopRecording(): void {
    this.isRecording = false
    this.status.isRecording = false
    this.status.isStreaming = false
    
    // Send any remaining audio
    if (this.streamingMode) {
      this.flushStreamingBuffer()
    } else {
      this.flushAudioQueue()
    }
    
    this.updateStatus()
  }

  // Enable/disable streaming mode
  setStreamingMode(enabled: boolean): void {
    this.streamingMode = enabled
    this.options.streamingMode = enabled
    
    // Clear buffers when switching modes
    this.audioQueue = []
    this.streamingBuffer = []
  }

  // Update VAD settings
  setVADSettings(enabled: boolean, threshold?: number): void {
    this.options.vadEnabled = enabled
    if (threshold !== undefined) {
      this.options.vadThreshold = threshold
    }
    
    // Send updated settings to worklet
    if (this.processorNode) {
      this.processorNode.port.postMessage({
        type: 'config',
        vadEnabled: enabled,
        vadThreshold: threshold || this.options.vadThreshold
      })
    }
  }

  // Get current audio status
  getStatus(): AudioStatus {
    return { ...this.status }
  }

  // Update status and notify callback
  private updateStatus(): void {
    if (this.onStatusUpdate) {
      this.onStatusUpdate({ ...this.status })
    }
  }

  dispose(): void {
    this.stopRecording()
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
