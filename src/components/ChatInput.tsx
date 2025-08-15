import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore } from '@/store/chat-store'
import { Send, Loader2, Type } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSendText?: (text: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatInput({ 
  onSendText, 
  disabled = false, 
  placeholder = "メッセージを入力...",
  className 
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendTextMessage, mic } = useChatStore()
  
  const isRecording = mic === 'recording'
  const isConnecting = mic === 'connecting'
  const canSend = text.trim().length > 0 && !isSending && !disabled

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [text])

  const handleSend = async () => {
    const trimmedText = text.trim()
    if (!trimmedText || isSending || disabled) return

    setIsSending(true)
    try {
      // Add to chat history immediately
      sendTextMessage(trimmedText)
      
      // Call optional callback for integration with AI response
      if (onSendText) {
        await onSendText(trimmedText)
      }
      
      setText('')
    } catch (error) {
      console.error('Failed to send text message:', error)
    } finally {
      setIsSending(false)
      // Focus back to textarea
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: new line (default behavior)
        return
      } else {
        // Enter: send message
        e.preventDefault()
        handleSend()
      }
    }
  }

  return (
    <div className={cn("p-4 bg-card border-t", className)} role="region" aria-label="テキスト入力">
      <div className="flex items-center gap-2 mb-2">
        <Type className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">テキストメッセージ</span>
        {isConnecting && (
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
            マイク接続中...
          </span>
        )}
        {isRecording && (
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
            音声録音中でも入力可能
          </span>
        )}
      </div>
      
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            className={cn(
              "min-h-[44px] max-h-32 resize-none transition-all",
              "focus:ring-2 focus:ring-primary focus:border-transparent"
            )}
            rows={1}
            aria-label="テキストメッセージを入力"
            aria-describedby="send-button-description"
          />
          <div id="send-button-description" className="sr-only">
            Enterキーで送信、Shift+Enterで改行
          </div>
        </div>
        
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="sm"
          className={cn(
            "h-11 px-3 transition-all",
            canSend ? "bg-primary hover:bg-primary/90" : "bg-muted"
          )}
          aria-label={
            isSending 
              ? "送信中..." 
              : canSend 
                ? "メッセージを送信" 
                : "メッセージを入力してください"
          }
          title={isSending ? "送信中..." : "Enter キーでも送信できます"}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
          {!isSending && <span className="sr-only">送信</span>}
        </Button>
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground">
        <span className="sr-only">使い方: </span>
        <span aria-hidden="true">Enter: 送信 | Shift+Enter: 改行</span>
      </div>
    </div>
  )
}