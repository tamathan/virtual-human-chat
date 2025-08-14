# Audio Worklet Implementation

## 📋 Overview
- **File**: `src/lib/audio/audio-worklet.js`
- **Registration name**: `audio-recorder-processor`
- **Loaded by**: `src/lib/audio/audio-processor.ts` via `audioContext.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url))`

## 🎯 Core Features

### Advanced Voice Activity Detection (VAD)
- **Adaptive Thresholds**: Dynamic threshold adjustment based on energy history
- **Speech State Machine**: Hysteresis to prevent false triggers
- **Minimum Frame Counting**: Configurable speech/silence frame requirements
- **Energy Smoothing**: Rolling average for stable detection

### Noise Reduction & Audio Enhancement
- **High-Pass Filter**: Removes DC offset and low-frequency noise (`highPassAlpha: 0.99`)
- **Noise Gate**: Aggressive reduction below threshold (`noiseGate: 0.005`)
- **Sample Validation**: Clamps invalid audio samples to valid range (-1, 1)
- **Noise Floor**: Configurable minimum energy threshold

### Error Handling & Recovery
- **Error Throttling**: Prevents excessive error reporting (1 second intervals)
- **Automatic Reset**: Processor reset after maximum errors (10 errors)
- **Graceful Degradation**: Continues processing despite individual frame errors
- **Fallback Parameters**: Safe defaults when initialization fails

### Performance Monitoring
- **Buffer Utilization**: Real-time buffer level tracking
- **Frame Counting**: Processed/dropped frame statistics
- **Memory Management**: Proper buffer cleanup and bounds checking

## 📡 Message Interface

### Outgoing Messages (Worklet → Main Thread)

#### Audio Data
```typescript
{
  type: 'audio',
  data: Float32Array,        // Audio samples (cloned buffer)
  isSpeech: boolean,         // VAD result
  energy: number,            // Current speech probability
  timestamp: number          // Processing timestamp
}
```

#### Status Updates (Periodic)
```typescript
{
  type: 'status',
  isSpeechActive: boolean,   // Current speech state
  speechProbability: number, // Smoothed speech confidence
  bufferLevel: number,       // Buffer utilization (0-1)
  errorCount: number,        // Cumulative error count
  timestamp: number
}
```

#### VAD Events
```typescript
{
  type: 'vad',
  isSpeech: boolean,         // Speech start/stop event
  energy: number,            // Current energy level
  threshold: number,         // Dynamic threshold used
  timestamp: number
}
```

#### Error Reports
```typescript
{
  type: 'error',
  context: string,           // Error context description
  message: string,           // Error message
  errorCount: number,        // Total error count
  timestamp: number
}
```

#### Configuration Confirmations
```typescript
{
  type: 'configUpdated',
  vadEnabled: boolean,       // Current VAD state
  vadThreshold: number,      // Current threshold
  noiseGate: number,         // Current noise gate
  timestamp: number
}
```

### Incoming Messages (Main Thread → Worklet)

#### Configuration Updates
```typescript
{
  type: 'config',
  vadEnabled?: boolean,      // Enable/disable VAD
  vadThreshold?: number,     // VAD sensitivity (0.001-0.1)
  noiseGate?: number         // Noise gate level (0.001-0.1)
}
```

## ⚙️ Configuration Parameters

### Voice Activity Detection
```typescript
{
  vadEnabled: true,          // Enable VAD processing
  vadThreshold: 0.01,        // Base energy threshold
  vadFrameSize: 512,         // Samples per VAD analysis
  minSpeechFrames: 5,        // Frames to confirm speech start
  minSilenceFrames: 20,      // Frames to confirm speech end
  minimumEnergyThreshold: 0.002
}
```

### Audio Processing
```typescript
{
  bufferSize: 4096,          // Main buffer size (1024-8192)
  noiseGate: 0.005,          // Noise suppression threshold
  noiseReduction: 0.1,       // Noise reduction factor
  highPassAlpha: 0.99,       // High-pass filter coefficient
  energyHistoryLength: 10    // VAD history window size
}
```

### Performance & Monitoring
```typescript
{
  reportInterval: 1000,      // Status report frequency (frames)
  maxErrors: 10,             // Error count before reset
  errorThrottleMs: 1000      // Error reporting throttle
}
```

## 🔧 Technical Implementation

### Adaptive VAD Algorithm
```typescript
// Dynamic threshold calculation
const adaptiveMultiplier = Math.max(0.3, Math.min(2.0, avgEnergy * 10))
const dynamicThreshold = Math.max(
  this.vadThreshold, 
  avgEnergy * adaptiveMultiplier
)

// Speech detection with hysteresis
const isSpeech = energy > dynamicThreshold && energy > this.minimumEnergyThreshold
```

### Error Recovery Strategy
```typescript
// Throttled error reporting
if (now - this.lastErrorTime < this.errorThrottleMs) return

// Automatic reset on excessive errors
if (this.errorCount >= this.maxErrors) {
  this.resetProcessor()
}
```

### Memory Management
```typescript
// Safe buffer copying to prevent transfer issues
const bufferToSend = new Float32Array(this.bufferIndex)
for (let i = 0; i < this.bufferIndex; i++) {
  bufferToSend[i] = this.buffer[i] || 0
}
```

## 🚀 Deployment Considerations

### Vite Integration
- Uses `new URL('./audio-worklet.js', import.meta.url)` for proper bundling
- Works correctly in both development and production builds
- Avoids hard-coded paths that break in different environments

### Performance Optimization
- Efficient sample-by-sample processing
- Minimal memory allocations in hot paths
- Configurable buffer sizes for different use cases

### Browser Compatibility
- Requires AudioWorklet support (Chrome 64+, Firefox 76+)
- Falls back gracefully when features are unavailable
- Handles browser-specific audio quirks

## 🔬 Tuning Guidelines

### VAD Sensitivity
- **Quiet Environment**: `vadThreshold: 0.005` (more sensitive)
- **Noisy Environment**: `vadThreshold: 0.02` (less sensitive)
- **Default**: `vadThreshold: 0.01` (balanced)

### Latency vs Quality
- **Low Latency**: Smaller `bufferSize` (1024-2048)
- **High Quality**: Larger `bufferSize` (4096-8192)
- **Balanced**: `bufferSize: 4096` (default)

### Speech Detection Timing
- **Responsive**: Lower `minSpeechFrames` (3-5)
- **Stable**: Higher `minSpeechFrames` (7-10)
- **Default**: `minSpeechFrames: 5`

