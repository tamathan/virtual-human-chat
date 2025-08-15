// Gemini Live API Client V3 - Based on official sample implementation
import { GoogleGenAI, Session, LiveServerMessage, Modality } from '@google/genai';
import { useChatStore } from '@/store/chat-store';

export interface GeminiMessage {
  type: 'audio' | 'text'
  content: string | ArrayBuffer
  role: 'user' | 'model'
}

// Utility functions (based on sample)
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = data[i] * 32768;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const buffer = ctx.createBuffer(
    numChannels,
    data.length / 2 / numChannels,
    sampleRate,
  );

  const dataInt16 = new Int16Array(data.buffer);
  const l = dataInt16.length;
  const dataFloat32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0;
  }
  
  // Extract interleaved channels
  if (numChannels === 1) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channel = dataFloat32.filter(
        (_, index) => index % numChannels === i,
      );
      buffer.copyToChannel(channel, i);
    }
  }

  return buffer;
}

export class GeminiLiveAPIClientV3 {
  private client: GoogleGenAI | null = null;
  private session: Session | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private isConnected = false;
  private isRecording = false;

  constructor(
    private apiKey: string,
    private onMessage: (message: GeminiMessage) => void,
    private onError: (error: Error) => void,
    private onStateChange: (connected: boolean) => void
  ) {}

  async connect(): Promise<void> {
    try {
      console.log('[GeminiV3] Initializing audio contexts...');
      
      // Initialize audio contexts with specific sample rates like the sample
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
      
      this.nextStartTime = this.outputAudioContext.currentTime;

      console.log('[GeminiV3] Initializing Google GenAI client...');
      
      // Initialize GenAI client exactly like the sample
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
      });

      console.log('[GeminiV3] Connecting to Gemini Live API...');
      
      // Connect using the exact same parameters as the sample
      this.session = await this.client.live.connect({
        model: 'gemini-2.5-flash-preview-native-audio-dialog',
        callbacks: {
          onopen: () => {
            console.log('[GeminiV3] Session opened successfully');
            this.isConnected = true;
            this.onStateChange(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log('[GeminiV3] Received message:', message);
            await this.handleMessage(message);
          },
          onerror: (error: ErrorEvent) => {
            console.error('[GeminiV3] Session error:', error);
            this.onError(new Error(error.message));
          },
          onclose: (event: CloseEvent) => {
            console.log('[GeminiV3] Session closed:', event.reason);
            this.isConnected = false;
            this.onStateChange(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            languageCode: 'ja-JP', // Japanese language optimization for speech synthesis
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Orus' // Use same voice as sample
              }
            }
          },
          // Optimize for immediate Japanese response
          temperature: 0.5, // Balanced for natural Japanese conversation with better response time
          maxOutputTokens: 500, // Optimized for real-time conversation
          systemInstruction: 'あなたは親しみやすい日本語でユーザーと会話するAIアシスタントです。自然で簡潔な応答を心がけ、相手に合わせたトーンで話してください。' // Japanese conversation optimization
        }
      });

      console.log('[GeminiV3] Connected successfully!');

    } catch (error) {
      console.error('[GeminiV3] Connection failed:', error);
      this.onError(error as Error);
    }
  }

  private async handleMessage(message: LiveServerMessage): Promise<void> {
    try {
      console.log('[GeminiV3] Received message:', JSON.stringify(message, null, 2));
      
      // Handle audio response (exactly like sample)
      const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
      console.log('[GeminiV3] Audio data found:', !!audio);

      if (audio && this.outputAudioContext) {
        console.log('[GeminiV3] Processing audio response...', audio.mimeType, audio.data ? `${audio.data.length} chars` : 'no data');
        
        this.nextStartTime = Math.max(
          this.nextStartTime,
          this.outputAudioContext.currentTime,
        );

        const audioBuffer = await decodeAudioData(
          decode(audio.data || ''),
          this.outputAudioContext,
          24000,
          1,
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        
        source.addEventListener('ended', () => {
          this.sources.delete(source);
          console.log('[GeminiV3] Audio playback ended');
        });

        console.log(`[GeminiV3] Starting audio playback at ${this.nextStartTime}, duration: ${audioBuffer.duration}s`);
        source.start(this.nextStartTime);
        this.nextStartTime = this.nextStartTime + audioBuffer.duration;
        this.sources.add(source);
        
        console.log('[GeminiV3] Audio should be playing now!');

        // Notify about audio response
        this.onMessage({
          type: 'audio',
          content: audioBuffer.getChannelData(0).buffer,
          role: 'model'
        });
        
        console.log('[GeminiV3] Message callback called with audio data');
      }

      // Handle text responses (for debugging and fallback)
      const textPart = message.serverContent?.modelTurn?.parts?.find(part => part.text);
      if (textPart?.text) {
        console.log('[GeminiV3] Received text response:', textPart.text);
        this.onMessage({
          type: 'text',
          content: textPart.text,
          role: 'model'
        });
      }

      // Handle interruption (exactly like sample)
      const interrupted = message.serverContent?.interrupted;
      if (interrupted) {
        console.log('[GeminiV3] Audio interrupted, stopping playback');
        for (const source of this.sources.values()) {
          source.stop();
          this.sources.delete(source);
        }
        this.nextStartTime = 0;
      }

      // Handle turn detection
      const turnDetection = message.serverContent?.turnComplete;
      if (turnDetection) {
        console.log('[GeminiV3] Turn complete detected');
      }

    } catch (error) {
      console.error('[GeminiV3] Error handling message:', error);
      this.onError(error as Error);
    }
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('[GeminiV3] Already recording');
      return;
    }

    if (!this.session) {
      console.error('[GeminiV3] Cannot start recording - session not connected');
      this.onError(new Error('セッションに接続されていません'));
      return;
    }

    if (!this.inputAudioContext) {
      console.error('[GeminiV3] Cannot start recording - audio context not initialized');
      this.onError(new Error('音声システムが初期化されていません'));
      return;
    }

    try {
      console.log('[GeminiV3] Starting recording...');
      useChatStore.getState().setMic('connecting');
      
      // Resume audio context first
      if (this.inputAudioContext.state === 'suspended') {
        console.log('[GeminiV3] Resuming suspended audio context...');
        await this.inputAudioContext.resume();
      }

      // Check microphone permission if available
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log(`[GeminiV3] Microphone permission status: ${permissionStatus.state}`);
          
          if (permissionStatus.state === 'denied') {
            throw new Error('マイクへのアクセスが拒否されています。ブラウザの設定で許可してください。');
          }
        } catch (permError) {
          console.warn(`[GeminiV3] Permission check error: ${permError}`);
        }
      }

      console.log('[GeminiV3] Requesting microphone access...');
      
      // Get media stream with specific constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false,
      });

      console.log('[GeminiV3] Microphone access granted, setting up audio pipeline...');
      console.log(`[GeminiV3] Audio tracks: ${this.mediaStream.getAudioTracks().length}`);

      // Set up audio processing pipeline exactly like sample
      this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
      console.log('[GeminiV3] MediaStreamSourceNode created');

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );
      console.log('[GeminiV3] ScriptProcessorNode created');

      let audioChunkCount = 0;
      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording || !this.session) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // Calculate RMS for monitoring
        let rms = 0;
        for (let i = 0; i < pcmData.length; i++) {
          rms += pcmData[i] * pcmData[i];
        }
        rms = Math.sqrt(rms / pcmData.length);

        // Send audio data using exact same format as sample
        try {
          this.session.sendRealtimeInput({ media: createBlob(pcmData) });
          audioChunkCount++;
          
          // Log every 50 chunks to avoid spam (more frequent for debugging)
          if (audioChunkCount % 50 === 0) {
            console.log(`[GeminiV3] Audio chunks sent: ${audioChunkCount} (RMS: ${rms.toFixed(4)})`);
          }
        } catch (error) {
          console.error('[GeminiV3] Error sending audio data:', error);
        }
      };

      // Connect audio pipeline
      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);
      console.log('[GeminiV3] Audio pipeline connected');

      this.isRecording = true;
      useChatStore.getState().setRecording(true);
      useChatStore.getState().setMic('recording');
      
      console.log('[GeminiV3] Recording started successfully - speak now!');

    } catch (error) {
      console.error('[GeminiV3] Failed to start recording:', error);
      
      let errorMessage = '音声録音を開始できませんでした';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してから再試行してください。';
          console.error('[GeminiV3] Microphone permission denied - check browser settings');
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'マイクが見つかりません。マイクが接続されているか確認してください。';
          console.error('[GeminiV3] Microphone device not found');
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'マイクが他のアプリケーションで使用中です。';
          console.error('[GeminiV3] Microphone in use by another application');
        } else {
          errorMessage = `音声エラー: ${error.message}`;
        }
      }
      
      useChatStore.getState().setMic('idle');
      this.onError(new Error(errorMessage));
      this.stopRecording();
    }
  }

  stopRecording(): void {
    if (!this.isRecording) return;

    console.log('[GeminiV3] Stopping recording...');

    this.isRecording = false;
    useChatStore.getState().setRecording(false);
    useChatStore.getState().setMic('idle');

    // Clean up audio processing pipeline
    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch (error) {
        console.warn('[GeminiV3] Error disconnecting scriptProcessorNode:', error);
      }
      this.scriptProcessorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (error) {
        console.warn('[GeminiV3] Error disconnecting sourceNode:', error);
      }
      this.sourceNode = null;
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
        console.log('[GeminiV3] Stopped media track:', track.kind);
      });
      this.mediaStream = null;
    }

    console.log('[GeminiV3] Recording stopped');
  }

  stopPlayback(): void {
    console.log('[GeminiV3] Stopping playback...');
    
    // Stop all audio sources
    for (const source of this.sources.values()) {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped
      }
    }
    this.sources.clear();
    this.nextStartTime = 0;
    
    useChatStore.getState().setPlayback('idle');
  }

  sendText(text: string): void {
    console.warn('[GeminiV3] Text-only sending not supported by Gemini Live API');
    console.log('[GeminiV3] Text would be:', text);
    
    // Gemini Live API requires audio media, not plain text
    // For text input, we would need:
    // 1. Text-to-Speech conversion, or
    // 2. Use regular Gemini API for text, or  
    // 3. Send empty audio with text prompt
    
    this.onError(new Error('Gemini Live APIはテキスト単体の送信に対応していません。音声入力を使用してください。'));
  }

  disconnect(): void {
    console.log('[GeminiV3] Disconnecting...');
    
    this.stopRecording();
    this.stopPlayback();
    
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    
    this.isConnected = false;
    this.client = null;
    
    console.log('[GeminiV3] Disconnected');
  }

  // Public status methods
  isWebSocketConnected(): boolean {
    return this.isConnected && this.session !== null;
  }

  getConnectionStatus(): string {
    if (!this.session) return 'disconnected';
    return this.isConnected ? 'connected' : 'connecting';
  }

  getReconnectInfo(): { attempts: number; maxAttempts: number; isReconnecting: boolean } {
    return {
      attempts: 0,
      maxAttempts: 0,
      isReconnecting: false
    };
  }

  getResourceUsage(): { activeContexts: number; activeSources: number; queueLength: number } {
    return {
      activeContexts: (this.inputAudioContext ? 1 : 0) + (this.outputAudioContext ? 1 : 0),
      activeSources: this.sources.size,
      queueLength: 0
    };
  }
}