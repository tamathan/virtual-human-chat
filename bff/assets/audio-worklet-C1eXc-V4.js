class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    
    // Initialize with parameters
    this.initializeParameters(options?.processorOptions || {})
    
    // Error handling state
    this.errorCount = 0
    this.maxErrors = 10
    this.lastErrorTime = 0
    this.errorThrottleMs = 1000
    
    // Listen for configuration updates
    this.port.onmessage = (event) => {
      try {
        if (event.data.type === 'config') {
          this.updateConfiguration(event.data)
        }
      } catch (error) {
        this.handleError('Config update failed', error)
      }
    }
  }

  process(inputs, outputs, parameters) {
    try {
      const input = inputs[0]
      
      if (!input || input.length === 0) {
        return true // Continue processing even with no input
      }
      
      const inputChannel = input[0]
      
      if (!inputChannel || inputChannel.length === 0) {
        return true
      }
      
      for (let i = 0; i < inputChannel.length; i++) {
        let sample = inputChannel[i]
        
        // Validate sample
        if (typeof sample !== 'number' || !isFinite(sample)) {
          sample = 0 // Replace invalid samples with silence
        }
        
        // Clamp sample to valid range
        sample = Math.max(-1, Math.min(1, sample))
        
        // High-pass filter to remove DC offset and low-frequency noise
        sample = sample - this.previousSample + this.highPassAlpha * this.previousSample
        this.previousSample = sample
        
        // Noise gate with improved detection
        if (Math.abs(sample) < this.noiseGate) {
          sample *= this.noiseReduction // More aggressive noise reduction
        }
        
        // Add to main buffer with bounds checking
        if (this.bufferIndex < this.bufferSize) {
          this.buffer[this.bufferIndex] = sample
          this.bufferIndex++
        }
        
        // Add to VAD buffer if enabled
        if (this.vadEnabled && this.vadBufferIndex < this.vadFrameSize) {
          this.vadBuffer[this.vadBufferIndex] = sample
          this.vadBufferIndex++
          
          if (this.vadBufferIndex >= this.vadFrameSize) {
            this.processVAD()
            this.vadBufferIndex = 0
          }
        }
        
        // Send buffer when full
        if (this.bufferIndex >= this.bufferSize) {
          this.sendBuffer()
          this.bufferIndex = 0
        }
      }
      
      // Report status periodically
      this.frameCount++
      if (this.frameCount >= this.reportInterval) {
        this.reportStatus()
        this.frameCount = 0
      }
      
      return true
    } catch (error) {
      this.handleError('Processing failed', error)
      return true // Continue processing despite errors
    }
  }
  
  processVAD() {
    try {
      // Calculate RMS energy with improved algorithm
      let energy = 0
      let validSamples = 0
      
      for (let i = 0; i < this.vadFrameSize; i++) {
        const sample = this.vadBuffer[i]
        if (typeof sample === 'number' && isFinite(sample)) {
          energy += sample * sample
          validSamples++
        }
      }
      
      if (validSamples === 0) {
        energy = 0
      } else {
        energy = Math.sqrt(energy / validSamples)
      }
      
      // Update energy history with bounds checking
      if (this.energyIndex >= this.energyHistory.length) {
        this.energyIndex = 0
      }
      
      this.energyHistory[this.energyIndex] = energy
      this.energyIndex = (this.energyIndex + 1) % this.energyHistory.length
      
      // Calculate average energy with null checking
      let avgEnergy = 0
      let validHistoryCount = 0
      
      for (let i = 0; i < this.energyHistory.length; i++) {
        const historyValue = this.energyHistory[i]
        if (typeof historyValue === 'number' && isFinite(historyValue)) {
          avgEnergy += historyValue
          validHistoryCount++
        }
      }
      
      if (validHistoryCount > 0) {
        avgEnergy = avgEnergy / validHistoryCount
      }
      
      // Adaptive VAD with improved thresholds
      const adaptiveMultiplier = Math.max(0.3, Math.min(2.0, avgEnergy * 10))
      const dynamicThreshold = Math.max(
        this.vadThreshold, 
        avgEnergy * adaptiveMultiplier
      )
      
      const isSpeech = energy > dynamicThreshold && energy > this.minimumEnergyThreshold
      
      // Speech state machine with hysteresis
      if (isSpeech) {
        this.speechFrameCount++
        this.silenceFrameCount = 0
        
        if (!this.isSpeechActive && this.speechFrameCount >= this.minSpeechFrames) {
          this.isSpeechActive = true
          this.reportVAD(true, energy, dynamicThreshold)
        }
      } else {
        this.silenceFrameCount++
        this.speechFrameCount = Math.max(0, this.speechFrameCount - 1)
        
        if (this.isSpeechActive && this.silenceFrameCount >= this.minSilenceFrames) {
          this.isSpeechActive = false
          this.reportVAD(false, energy, dynamicThreshold)
        }
      }
      
      // Update speech probability with smoothing
      const newProbability = Math.min(1.0, energy / Math.max(dynamicThreshold, 0.001))
      this.speechProbability = this.speechProbability * 0.7 + newProbability * 0.3
      
    } catch (error) {
      this.handleError('VAD processing failed', error)
    }
  }
  
  reportVAD(isSpeech, energy, threshold) {
    try {
      this.port.postMessage({
        type: 'vad',
        isSpeech,
        energy,
        threshold,
        timestamp: currentTime || Date.now()
      })
    } catch (error) {
      this.handleError('VAD reporting failed', error)
    }
  }
  
  sendBuffer() {
    try {
      // Only send if VAD is disabled or speech is active
      const shouldSend = !this.vadEnabled || this.isSpeechActive
      
      if (shouldSend && this.buffer && this.bufferIndex > 0) {
        // Create a copy of the buffer to send
        const bufferToSend = new Float32Array(this.bufferIndex)
        for (let i = 0; i < this.bufferIndex; i++) {
          bufferToSend[i] = this.buffer[i] || 0
        }
        
        this.port.postMessage({
          type: 'audio',
          data: bufferToSend,
          isSpeech: this.isSpeechActive,
          energy: this.speechProbability,
          timestamp: currentTime || Date.now()
        })
      }
    } catch (error) {
      this.handleError('Buffer sending failed', error)
    }
  }
  
  reportStatus() {
    try {
      this.port.postMessage({
        type: 'status',
        isSpeechActive: this.isSpeechActive,
        speechProbability: this.speechProbability,
        bufferLevel: this.bufferIndex / this.bufferSize,
        errorCount: this.errorCount,
        timestamp: currentTime || Date.now()
      })
    } catch (error) {
      this.handleError('Status reporting failed', error)
    }
  }
  
  initializeParameters(options) {
    try {
      // Buffer management with validation
      this.bufferSize = Math.max(1024, Math.min(8192, options.bufferSize || 4096))
      this.buffer = new Float32Array(this.bufferSize)
      this.bufferIndex = 0
      
      // VAD (Voice Activity Detection) parameters with validation
      this.vadEnabled = Boolean(options.vadEnabled !== undefined ? options.vadEnabled : true)
      this.vadThreshold = Math.max(0.001, Math.min(0.1, options.vadThreshold || 0.01))
      this.vadFrameSize = Math.max(256, Math.min(1024, options.vadFrameSize || 512))
      this.vadBuffer = new Float32Array(this.vadFrameSize)
      this.vadBufferIndex = 0
      this.speechProbability = 0
      this.speechFrameCount = 0
      this.silenceFrameCount = 0
      this.minSpeechFrames = Math.max(3, Math.min(10, options.minSpeechFrames || 5))
      this.minSilenceFrames = Math.max(10, Math.min(50, options.minSilenceFrames || 20))
      this.isSpeechActive = false
      this.minimumEnergyThreshold = 0.002
      
      // Noise reduction parameters with validation
      this.noiseFloor = Math.max(0.0001, Math.min(0.01, options.noiseFloor || 0.001))
      this.noiseGate = Math.max(0.001, Math.min(0.1, options.noiseGate || 0.005))
      this.noiseReduction = Math.max(0.01, Math.min(0.5, options.noiseReduction || 0.1))
      this.previousSample = 0
      this.highPassAlpha = Math.max(0.9, Math.min(0.999, options.highPassAlpha || 0.99))
      
      // Energy calculation for VAD with validation
      const historyLength = Math.max(5, Math.min(20, options.energyHistoryLength || 10))
      this.energyHistory = new Array(historyLength).fill(0)
      this.energyIndex = 0
      
      // Status reporting with validation
      this.frameCount = 0
      this.reportInterval = Math.max(500, Math.min(2000, options.reportInterval || 1000))
      
      // Performance monitoring
      this.processedFrames = 0
      this.droppedFrames = 0
      
    } catch (error) {
      this.handleError('Parameter initialization failed', error)
      // Fallback to safe defaults
      this.initializeFallbackParameters()
    }
  }
  
  initializeFallbackParameters() {
    // Safe fallback parameters
    this.bufferSize = 4096
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
    this.vadEnabled = true
    this.vadThreshold = 0.01
    this.vadFrameSize = 512
    this.vadBuffer = new Float32Array(this.vadFrameSize)
    this.vadBufferIndex = 0
    this.speechProbability = 0
    this.speechFrameCount = 0
    this.silenceFrameCount = 0
    this.minSpeechFrames = 5
    this.minSilenceFrames = 20
    this.isSpeechActive = false
    this.noiseFloor = 0.001
    this.noiseGate = 0.005
    this.noiseReduction = 0.1
    this.previousSample = 0
    this.highPassAlpha = 0.99
    this.energyHistory = new Array(10).fill(0)
    this.energyIndex = 0
    this.frameCount = 0
    this.reportInterval = 1000
    this.minimumEnergyThreshold = 0.002
  }
  
  updateConfiguration(config) {
    try {
      let updated = false
      
      if (config.vadEnabled !== undefined) {
        this.vadEnabled = Boolean(config.vadEnabled)
        updated = true
      }
      
      if (config.vadThreshold !== undefined) {
        const threshold = parseFloat(config.vadThreshold)
        if (!isNaN(threshold) && threshold >= 0.001 && threshold <= 0.1) {
          this.vadThreshold = threshold
          updated = true
        }
      }
      
      if (config.noiseGate !== undefined) {
        const gate = parseFloat(config.noiseGate)
        if (!isNaN(gate) && gate >= 0.001 && gate <= 0.1) {
          this.noiseGate = gate
          updated = true
        }
      }
      
      if (updated) {
        // Send confirmation
        this.port.postMessage({
          type: 'configUpdated',
          vadEnabled: this.vadEnabled,
          vadThreshold: this.vadThreshold,
          noiseGate: this.noiseGate,
          timestamp: currentTime || Date.now()
        })
      }
    } catch (error) {
      this.handleError('Configuration update failed', error)
    }
  }
  
  handleError(context, error) {
    const now = Date.now()
    
    // Throttle error reporting
    if (now - this.lastErrorTime < this.errorThrottleMs) {
      return
    }
    
    this.errorCount++
    this.lastErrorTime = now
    
    // Log error details
    const errorInfo = {
      type: 'error',
      context,
      message: error?.message || 'Unknown error',
      errorCount: this.errorCount,
      timestamp: now
    }
    
    try {
      this.port.postMessage(errorInfo)
    } catch (postError) {
      // If we can't even post the error, just log to console
      console.error('AudioWorklet error:', errorInfo, postError)
    }
    
    // If too many errors, try to reset
    if (this.errorCount >= this.maxErrors) {
      this.resetProcessor()
    }
  }
  
  resetProcessor() {
    try {
      // Reset buffers
      this.bufferIndex = 0
      this.vadBufferIndex = 0
      
      // Clear arrays
      if (this.buffer) {
        this.buffer.fill(0)
      }
      if (this.vadBuffer) {
        this.vadBuffer.fill(0)
      }
      if (this.energyHistory) {
        this.energyHistory.fill(0)
      }
      
      // Reset state
      this.speechProbability = 0
      this.speechFrameCount = 0
      this.silenceFrameCount = 0
      this.isSpeechActive = false
      this.previousSample = 0
      this.energyIndex = 0
      this.frameCount = 0
      
      // Reset error state
      this.errorCount = 0
      this.lastErrorTime = 0
      
      this.port.postMessage({
        type: 'reset',
        message: 'Processor reset due to errors',
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to reset processor:', error)
    }
  }
  
  // Performance monitoring
  getPerformanceStats() {
    return {
      processedFrames: this.processedFrames,
      droppedFrames: this.droppedFrames,
      errorCount: this.errorCount,
      bufferUtilization: this.bufferIndex / this.bufferSize
    }
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor)