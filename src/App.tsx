import { useEffect, useState } from 'react'
import { useChatStore } from './store/chat-store'
import { useVirtualHuman } from './hooks/useVirtualHuman'
import { useToast } from './hooks/use-toast'
import { ConnectionStatus } from './components/ConnectionStatus'
import { ChatHistory } from './components/ChatHistory'
import { ControlPanel } from './components/ControlPanel'
import { ConversationPanel } from './components/conversation/ConversationPanel'
import { Toaster } from './components/ui/toaster'
import { Button } from './components/ui/button'

function App() {
  const { connection, error, setError } = useChatStore()
  const { toast } = useToast()
  const [showAdvancedAudio, setShowAdvancedAudio] = useState(false)
  const [useNewUI, setUseNewUI] = useState(true) // 新UIの切り替えフラグ
  const {
    isInitialized,
    connect,
    disconnect,
    toggleMic,
    stopPlayback,
    resetConversation,
    sendTextMessage,
    audioStatus
  } = useVirtualHuman()

  // Show error toasts
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error,
      })
      setError(null)
    }
  }, [error, toast, setError])

  const isConnected = connection === 'connected'

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border-b px-4 py-3">
        <h1 className="text-xl font-bold">Virtual Human Chat</h1>
        
        <div className="flex items-center gap-2">
          {/* UI切り替えボタン */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUseNewUI(!useNewUI)}
            className="text-xs"
          >
            {useNewUI ? '📊 クラシック' : '🎭 キャラクター'}
          </Button>
          
          {!isInitialized && (
            <div className="text-sm text-muted-foreground">初期化中...</div>
          )}
          {!isConnected ? (
            <Button 
              onClick={connect}
              disabled={connection === 'connecting' || !isInitialized}
              className="bg-green-600 hover:bg-green-700"
            >
              {connection === 'connecting' ? '🔄 接続中...' : '🔗 Gemini Liveに接続'}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={disconnect}
              className="border-red-500 text-red-500 hover:bg-red-50"
            >
              🔌 切断
            </Button>
          )}
        </div>
      </div>

      {useNewUI ? (
        /* 新しいキャラクターUI */
        <div className="flex-1 flex">
          <ConversationPanel />
          
          {/* 右下の簡単なコントロール */}
          <div className="absolute bottom-4 right-4 z-40">
            <div className="flex space-x-2">
              <Button
                onClick={toggleMic}
                disabled={!isConnected}
                className={`rounded-full w-14 h-14 text-2xl ${
                  !isConnected ? 'bg-gray-400' :
                  connection === 'connected' ? 'bg-blue-500 hover:bg-blue-600' : 
                  'bg-gray-400'
                }`}
              >
                🎤
              </Button>
              <Button
                onClick={stopPlayback}
                variant="outline"
                className="rounded-full w-14 h-14 text-2xl"
              >
                ⏹️
              </Button>
              <Button
                onClick={resetConversation}
                variant="outline"
                className="rounded-full w-14 h-14 text-2xl"
              >
                🔄
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* 従来のUI */
        <>
          <ConnectionStatus />
          <ChatHistory />
          <ControlPanel
            onMicToggle={toggleMic}
            onStop={stopPlayback}
            onReset={resetConversation}
            onSendText={sendTextMessage}
            onSettings={() => setShowAdvancedAudio(!showAdvancedAudio)}
            isConnected={isConnected}
            audioStatus={audioStatus}
            showAdvanced={showAdvancedAudio}
          />
        </>
      )}

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

export default App