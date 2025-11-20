import { } from 'react'
import { cn } from '@/lib/utils'
import type { SpeechBubbleProps } from '@/types'

export function SpeechBubble({ 
  message, 
  isLatest = false, 
  showTimestamp = true 
}: SpeechBubbleProps) {
  const isUser = message.role === 'user'
  const isAudio = message.messageType === 'audio'
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getBubbleContent = () => {
    if (isAudio && message.audioUrl) {
      return (
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            isUser ? "bg-blue-300" : "bg-green-300"
          )} />
          <span className="text-sm opacity-80">
            {message.text || (isUser ? "音声メッセージ" : "音声応答")}
          </span>
          <audio 
            controls 
            className="max-w-48 h-8"
            src={message.audioUrl}
          >
            お使いのブラウザは音声再生に対応していません。
          </audio>
        </div>
      )
    }
    
    return message.text || message.content || ""
  }

  return (
    <div className={cn(
      "flex w-full gap-3 px-4 py-3",
      isUser ? "justify-end" : "justify-start",
      isLatest && "animate-in slide-in-from-bottom-2 duration-300"
    )}>
      {/* アバター */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
          🤖
        </div>
      )}
      
      {/* メッセージ吹き出し */}
      <div className={cn(
        "relative max-w-md px-4 py-3 rounded-2xl shadow-sm",
        isUser 
          ? "bg-blue-500 text-white rounded-br-md" 
          : "bg-white border border-gray-200 text-gray-800 rounded-bl-md",
        isLatest && "shadow-md"
      )}>
        {/* 吹き出しの三角形 */}
        <div className={cn(
          "absolute top-4 w-3 h-3 transform rotate-45",
          isUser 
            ? "right-[-6px] bg-blue-500" 
            : "left-[-6px] bg-white border-l border-b border-gray-200"
        )} />
        
        {/* メッセージ内容 */}
        <div className="relative z-10">
          {getBubbleContent()}
        </div>
        
        {/* タイムスタンプ */}
        {showTimestamp && (
          <div className={cn(
            "text-xs mt-2 opacity-60",
            isUser ? "text-blue-100" : "text-gray-500"
          )}>
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
      
      {/* ユーザーアバター */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
          👤
        </div>
      )}
    </div>
  )
}