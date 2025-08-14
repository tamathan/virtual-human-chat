import { GoogleGenAI, Session, LiveServerMessage, Modality } from '@google/genai';
import { useChatStore } from '@/store/chat-store';

export interface GeminiMessage {
  type: 'audio' | 'text' | 'function_call' | 'function_response'
  content: string | ArrayBuffer
  role: 'user' | 'model'
}

export class GeminiLiveAPIClientV2 {
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
      console.log('Initializing Google GenAI client...');
      
      // Initialize audio contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
      this.nextStartTime = this.outputAudioContext.currentTime;

      // Initialize GenAI client
      this.client = new GoogleGenAI({
        apiKey: this.apiKey || ''
      });

      console.log('Connecting to Gemini Live API...');
      
      // Connect to session
      this.session = await this.client.live.connect({
        model: 'gemini-2.5-flash-preview-native-audio-dialog',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened');
            this.isConnected = true;
            this.onStateChange(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleMessage(message);
          },
          onerror: (error: ErrorEvent) => {
            console.error('Gemini Live session error:', error);
            this.onError(new Error(error.message));
          },
          onclose: (event: CloseEvent) => {
            console.log('Gemini Live session closed:', event.reason);
            this.isConnected = false;
            this.onStateChange(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Charon' // Japanese-optimized voice
              }
            }
          }
        }
      });

      console.log('Gemini Live session connected successfully');

    } catch (error) {
      console.error('Failed to connect to Gemini Live API:', error);
      this.onError(error as Error);
    }
  }

  private async handleMessage(message: LiveServerMessage): Promise<void> {
    try {
      const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
      
      if (audio) {
        // Handle audio response
        console.log('Received audio response');
        
        this.nextStartTime = Math.max(
          this.nextStartTime,
          this.outputAudioContext!.currentTime
        );

        const audioBuffer = await this.decodeAudioData(
          this.base64ToArrayBuffer(audio.data || ''),
          this.outputAudioContext!,
          24000,
          1
        );

        const source = this.outputAudioContext!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext!.destination);
        
        source.addEventListener('ended', () => {
          this.sources.delete(source);
        });

        source.start(this.nextStartTime);
        this.nextStartTime = this.nextStartTime + audioBuffer.duration;
        this.sources.add(source);

        this.onMessage({
          type: 'audio',
          content: audioBuffer.getChannelData(0).buffer,
          role: 'model'
        });
      }

      // Handle text response
      const text = message.serverContent?.modelTurn?.parts?.find(part => part.text)?.text;
      if (text) {
        console.log('Received text response:', text);
        this.onMessage({
          type: 'text',
          content: text,
          role: 'model'
        });
      }

      // Handle interruption
      const interrupted = message.serverContent?.interrupted;
      if (interrupted) {
        console.log('Audio interrupted, stopping playback');
        for (const source of this.sources.values()) {
          source.stop();
          this.sources.delete(source);
        }
        this.nextStartTime = 0;
      }

    } catch (error) {
      console.error('Error handling message:', error);
      this.onError(error as Error);
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async decodeAudioData(
    data: ArrayBuffer,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ): Promise<AudioBuffer> {
    const uint8Data = new Uint8Array(data);
    const buffer = ctx.createBuffer(
      numChannels,
      uint8Data.length / 2 / numChannels,
      sampleRate
    );

    const dataInt16 = new Int16Array(data);
    const l = dataInt16.length;
    const dataFloat32 = new Float32Array(l);
    
    for (let i = 0; i < l; i++) {
      dataFloat32[i] = dataInt16[i] / 32768.0;
    }

    if (numChannels === 1) {
      buffer.copyToChannel(dataFloat32, 0);
    } else {
      for (let i = 0; i < numChannels; i++) {
        const channel = dataFloat32.filter(
          (_, index) => index % numChannels === i
        );
        buffer.copyToChannel(channel, i);
      }
    }

    return buffer;
  }

  async startRecording(): Promise<void> {
    if (this.isRecording || !this.session) {
      return;
    }

    try {
      console.log('Requesting microphone access...');
      
      await this.inputAudioContext!.resume();

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      console.log('Microphone access granted, starting recording...');

      this.sourceNode = this.inputAudioContext!.createMediaStreamSource(this.mediaStream);
      
      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext!.createScriptProcessor(
        bufferSize,
        1,
        1
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // Convert Float32Array to Blob format for Gemini
        const blob = this.createBlob(pcmData);
        this.session!.sendRealtimeInput({ media: blob });
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext!.destination);

      this.isRecording = true;
      useChatStore.getState().setRecording(true);
      
      console.log('Recording started successfully');

    } catch (error) {
      console.error('Error starting recording:', error);
      this.onError(error as Error);
      this.stopRecording();
    }
  }

  stopRecording(): void {
    if (!this.isRecording) return;

    console.log('Stopping recording...');

    this.isRecording = false;
    useChatStore.getState().setRecording(false);

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    console.log('Recording stopped');
  }

  private createBlob(data: Float32Array): { data: string; mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    
    for (let i = 0; i < l; i++) {
      // Convert float32 -1 to 1 to int16 -32768 to 32767
      int16[i] = data[i] * 32768;
    }

    return {
      data: this.encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  private encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  sendText(text: string): void {
    if (!this.session) {
      console.warn('Session not connected');
      return;
    }

    try {
      console.log('Sending text:', text);
      
      // Stop current playback (barge-in)
      this.stopPlayback();
      
      // For the official API, we use sendMessage for text
      // Note: This API might be different - checking the actual implementation
      console.warn('Text sending not yet implemented for this API version');
      
    } catch (error) {
      console.error('Error sending text:', error);
      this.onError(new Error('Failed to send text message'));
    }
  }

  stopPlayback(): void {
    // Stop all active audio sources
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

  disconnect(): void {
    console.log('Disconnecting from Gemini Live API...');
    
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
    
    console.log('Disconnected from Gemini Live API');
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