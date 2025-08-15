import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useChatStore } from '@/store/chat-store'
import { Mic, MicOff, Square, RotateCcw, Waves, Settings, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AudioStatus } from '@/lib/audio/audio-processor'
import { useEffect, useRef, useState } from 'react'
import { ChatInput } from './ChatInput'

interface ControlPanelProps {
  onMicToggle: () => void
  onStop: () => void
  onReset: () => void
  onSettings?: () => void
  onSendText?: (text: string) => void
  isConnected: boolean
  audioStatus?: AudioStatus
  showAdvanced?: boolean
  showTextInput?: boolean
}

export function ControlPanel({
  onMicToggle,
  onStop,
  onReset,
  onSettings,
  onSendText,
  isConnected,
  audioStatus,
  showAdvanced = false,
  showTextInput = true
}: ControlPanelProps) {
  const { mic, playback } = useChatStore()
  const micButtonRef = useRef<HTMLButtonElement>(null)
  const statusAnnouncementRef = useRef<HTMLDivElement>(null)
  const [isTextInputCollapsed, setIsTextInputCollapsed] = useState(false)
  
  const isRecording = mic === 'recording'
  const isConnecting = mic === 'connecting'
  const isPlaying = playback === 'playing'
  const isSpeechDetected = audioStatus?.isSpeechActive || false
  const speechProbability = audioStatus?.speechProbability || 0
  const bufferLevel = audioStatus?.bufferLevel || 0
  const isStreaming = audioStatus?.isStreaming || false

  // Screen reader announcements for state changes
  useEffect(() => {
    if (statusAnnouncementRef.current) {
      let announcement = ''
      
      if (isRecording && isStreaming && isSpeechDetected) {
        announcement = '音声送信中です'
      } else if (isRecording && isStreaming) {
        announcement = '音声待機中です'
      } else if (isRecording) {
        announcement = '録音中です'
      } else if (isPlaying) {
        announcement = '再生中です'
      } else if (isConnected) {
        announcement = '接続済み、マイクボタンで音声入力を開始できます'
      } else {
        announcement = '未接続です'
      }
      
      statusAnnouncementRef.current.textContent = announcement
    }
  }, [isRecording, isPlaying, isConnected, isStreaming, isSpeechDetected])

  // Keyboard navigation support
  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  // Focus management for better UX
  useEffect(() => {
    if (!isRecording && micButtonRef.current) {
      // Return focus to mic button when recording stops
      micButtonRef.current.focus()
    }
  }, [isRecording])

  return (
    <div className="p-4 bg-card border-t" role="region" aria-label="音声コントロールパネル">
      {/* Screen reader only status announcements */}
      <div 
        ref={statusAnnouncementRef}
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      />

      {/* Advanced Audio Status */}
      {showAdvanced && audioStatus && (
        <div className="mb-4 p-3 bg-muted rounded-lg" role="group" aria-labelledby="audio-status-heading">
          <div className="flex items-center justify-between mb-2">
            <h3 id="audio-status-heading" className="text-sm font-medium">音声ステータス</h3>
            <div className="flex gap-2" role="group" aria-label="音声状態インジケーター">
              {isSpeechDetected && (
                <Badge 
                  variant="default" 
                  className="text-xs"
                  aria-label="音声検出中"
                >
                  <Waves className="w-3 h-3 mr-1" aria-hidden="true" />
                  音声検出中
                </Badge>
              )}
              {isStreaming && (
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  aria-label="ストリーミング中"
                >
                  <span className="animate-pulse" aria-hidden="true">📡</span>
                  ストリーミング中
                </Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <label htmlFor="speech-intensity">音声強度</label>
                <span aria-describedby="speech-intensity">{Math.round(speechProbability * 100)}%</span>
              </div>
              <Progress 
                id="speech-intensity"
                value={speechProbability * 100} 
                className="h-2"
                aria-label={`音声強度 ${Math.round(speechProbability * 100)}パーセント`}
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <label htmlFor="buffer-level">バッファレベル</label>
                <span aria-describedby="buffer-level">{Math.round(bufferLevel * 100)}%</span>
              </div>
              <Progress 
                id="buffer-level"
                value={bufferLevel * 100} 
                className="h-2"
                aria-label={`バッファレベル ${Math.round(bufferLevel * 100)}パーセント`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4" role="group" aria-label="音声コントロールボタン">
        {/* Mic Button with enhanced accessibility */}
        <div className="flex flex-col items-center gap-2">
          <Button
            ref={micButtonRef}
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className={cn(
              "w-20 h-20 rounded-full transition-all duration-200 flex flex-col items-center justify-center",
              !isConnected && !isConnecting && "bg-gray-300 cursor-not-allowed",
              isConnecting && "bg-yellow-500 animate-pulse",
              isConnected && !isRecording && !isConnecting && "bg-blue-600 hover:bg-blue-700",
              isRecording && "bg-red-600 hover:bg-red-700 animate-pulse",
              isSpeechDetected && isRecording && "ring-4 ring-green-400 ring-opacity-50",
              isStreaming && "ring-4 ring-blue-400 ring-opacity-50"
            )}
            onClick={onMicToggle}
            onKeyDown={(e) => handleKeyDown(e, onMicToggle)}
            disabled={!isConnected && !isConnecting}
            aria-label={
              isConnecting
                ? "マイク接続中..."
                : isRecording 
                  ? "音声入力を停止" 
                  : isConnected 
                    ? "音声入力を開始" 
                    : "接続が必要です"
            }
            aria-describedby="mic-button-description"
            aria-pressed={isRecording}
            title={isRecording ? "クリックまたはスペースキーで音声入力を停止" : "クリックまたはスペースキーで音声入力を開始"}
          >
            {isConnecting ? (
              <>
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
                <span className="text-xs mt-1">接続中</span>
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-8 h-8" aria-hidden="true" />
                <span className="text-xs mt-1">停止</span>
              </>
            ) : (
              <>
                <Mic className="w-8 h-8" aria-hidden="true" />
                <span className="text-xs mt-1">{isConnected ? "話す" : "要接続"}</span>
              </>
            )}
          </Button>
          <div className="text-xs text-center text-muted-foreground max-w-20">
            {isConnecting ? "接続中" : isRecording ? "録音中" : isConnected ? "マイク" : "未接続"}
          </div>
        </div>

        {/* Hidden description for screen readers */}
        <div id="mic-button-description" className="sr-only">
          {isRecording 
            ? "現在音声を録音中です。ボタンを押すと録音を停止します。"
            : isConnected 
              ? "音声入力を開始するにはこのボタンを押してください。"
              : "Gemini APIに接続してから音声入力を開始してください。"
          }
        </div>

        {/* Stop Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            className={cn(
              "w-16 h-16 rounded-full flex flex-col items-center justify-center",
              isPlaying ? "border-orange-500 text-orange-600 hover:bg-orange-50" : "border-gray-300 text-gray-400"
            )}
            onClick={onStop}
            onKeyDown={(e) => handleKeyDown(e, onStop)}
            disabled={!isPlaying}
            aria-label="音声再生を停止"
            title="音声再生を停止"
          >
            <Square className="w-6 h-6" aria-hidden="true" />
            <span className="text-xs mt-1">停止</span>
          </Button>
          <div className="text-xs text-center text-muted-foreground max-w-16">
            再生停止
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            className="w-16 h-16 rounded-full flex flex-col items-center justify-center border-purple-500 text-purple-600 hover:bg-purple-50"
            onClick={onReset}
            onKeyDown={(e) => handleKeyDown(e, onReset)}
            aria-label="会話をリセット"
            title="会話履歴をクリアして新しい会話を開始"
          >
            <RotateCcw className="w-6 h-6" aria-hidden="true" />
            <span className="text-xs mt-1">リセット</span>
          </Button>
          <div className="text-xs text-center text-muted-foreground max-w-16">
            会話クリア
          </div>
        </div>

        {/* Settings Button */}
        {onSettings && (
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              className="w-16 h-16 rounded-full flex flex-col items-center justify-center border-gray-500 text-gray-600 hover:bg-gray-50"
              onClick={onSettings}
              onKeyDown={(e) => handleKeyDown(e, onSettings)}
              aria-label="設定を開く"
              title="音声設定と詳細オプション"
            >
              <Settings className="w-6 h-6" aria-hidden="true" />
              <span className="text-xs mt-1">設定</span>
            </Button>
            <div className="text-xs text-center text-muted-foreground max-w-16">
              詳細設定
            </div>
          </div>
        )}
      </div>

      {/* Status Messages with proper semantic markup */}
      <div 
        className="mt-3 text-center text-sm text-muted-foreground" 
        role="status" 
        aria-live="polite"
        aria-atomic="true"
      >
        {!isConnected && "接続してください"}
        {isConnected && !isRecording && !isPlaying && "マイクボタンを押して話してください"}
        {isRecording && !isStreaming && "録音中..."}
        {isRecording && isStreaming && isSpeechDetected && "音声送信中... 🎤"}
        {isRecording && isStreaming && !isSpeechDetected && "音声待機中..."}
        {isPlaying && "再生中..."}
      </div>

      {/* Real-time Audio Visualization with accessibility enhancements */}
      {isRecording && speechProbability > 0 && (
        <div 
          className="mt-2 flex items-center justify-center"
          role="img"
          aria-label={`音声レベル表示: ${Math.round(speechProbability * 100)}パーセント`}
        >
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 bg-green-500 rounded-full transition-all duration-100",
                  speechProbability > i * 0.2 ? "h-4" : "h-2",
                  speechProbability > i * 0.2 ? "opacity-100" : "opacity-30"
                )}
              />
            ))}
          </div>
          
          {/* Screen reader alternative for visualization */}
          <span className="sr-only">
            音声レベル: {Math.round(speechProbability * 100)}パーセント、
            5段階中{Math.ceil(speechProbability * 5)}段階目
          </span>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        <span className="sr-only">キーボードショートカット: </span>
        <span aria-hidden="true">Space: 音声入力切替 | Enter: ボタン実行</span>
      </div>

      {/* Text Input Section */}
      {showTextInput && (
        <div className="mt-4 border-t border-border">
          {/* Collapse/Expand Button */}
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTextInputCollapsed(!isTextInputCollapsed)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label={isTextInputCollapsed ? "テキスト入力を展開" : "テキスト入力を折りたたむ"}
            >
              {isTextInputCollapsed ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  テキスト入力を表示
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  テキスト入力を隠す
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Text Input */}
          {!isTextInputCollapsed && (
            <ChatInput
              onSendText={onSendText}
              disabled={!isConnected}
              placeholder={isConnected ? "テキストメッセージを入力..." : "接続してください"}
              className="border-0 bg-transparent"
            />
          )}
        </div>
      )}
    </div>
  )
}