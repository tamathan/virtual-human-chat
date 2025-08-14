import { useChatStore } from '@/store/chat-store'
import { Button } from '@/components/ui/button'
import { PlayCircle, User, Bot, Mic, Type, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatHistory() {
  const { history } = useChatStore()

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getMessageTypeIcon = (messageType?: string) => {
    switch (messageType) {
      case 'audio':
        return <Mic className="w-3 h-3" />
      case 'text':
        return <Type className="w-3 h-3" />
      case 'hybrid':
        return <Headphones className="w-3 h-3" />
      default:
        return null
    }
  }

  const getMessageTypeLabel = (messageType?: string) => {
    switch (messageType) {
      case 'audio':
        return '音声'
      case 'text':
        return 'テキスト'
      case 'hybrid':
        return 'ハイブリッド'
      default:
        return ''
    }
  }

  if (history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>マイクボタンを押すか、テキストを入力して会話を始めましょう</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      {history.map((message, index) => (
        <div 
          key={index}
          className={cn(
            'flex gap-3 max-w-4xl',
            message.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          {message.role === 'assistant' && (
            <div className="flex-shrink-0">
              <Bot className="w-8 h-8 text-primary" />
            </div>
          )}
          
          <div 
            className={cn(
              'max-w-md p-3 rounded-lg',
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            )}
          >
            {/* Message type indicator */}
            {message.messageType && (
              <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                {getMessageTypeIcon(message.messageType)}
                <span>{getMessageTypeLabel(message.messageType)}</span>
              </div>
            )}

            {message.text && (
              <p className="text-sm leading-relaxed">{message.text}</p>
            )}
            
            {message.audioUrl && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    const audio = new Audio(message.audioUrl)
                    audio.play()
                  }}
                  aria-label="音声メッセージを再生"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span className="text-xs ml-1">再生</span>
                </Button>
              </div>
            )}
            
            <div className="mt-1 text-xs opacity-70">
              {formatTime(message.timestamp)}
            </div>
          </div>

          {message.role === 'user' && (
            <div className="flex-shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}