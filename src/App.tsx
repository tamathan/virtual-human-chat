import { useEffect, useState } from 'react'
import { useChatStore } from './store/chat-store'
import { useVirtualHuman } from './hooks/useVirtualHuman'
import { useToast } from './hooks/use-toast'
import { ConnectionStatus } from './components/ConnectionStatus'
import { ChatHistory } from './components/ChatHistory'
import { ControlPanel } from './components/ControlPanel'
import { Toaster } from './components/ui/toaster'
import { Button } from './components/ui/button'

function App() {
  const { connection, error, setError } = useChatStore()
  const { toast } = useToast()
  const [showAdvancedAudio, setShowAdvancedAudio] = useState(false)
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

      {/* Connection Status */}
      <ConnectionStatus />

      {/* Chat History */}
      <ChatHistory />

      {/* Control Panel */}
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

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

export default App