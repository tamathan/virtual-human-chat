import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chat-store'
import { SpeechBubble } from './SpeechBubble'
import { SubtitleDisplay } from './SubtitleDisplay'
import { SimpleAvatar } from '../avatar/SimpleAvatar'
import type { AvatarState, AvatarEmotion } from '@/types'

export function ConversationPanel() {
  const { history, connection, mic, recording } = useChatStore()
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'assistant' | null>(null)
  const [speechIntensity, setSpeechIntensity] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  // 最新メッセージを字幕として表示
  useEffect(() => {
    if (history.length > 0) {
      const latestMessage = history[history.length - 1]
      if (latestMessage.text && latestMessage.text !== '🎤 音声入力中...' && latestMessage.text !== '🔇 音声入力停止') {
        setCurrentSubtitle(latestMessage.text)
        setCurrentSpeaker(latestMessage.role)
        
        // 3秒後に字幕を消す
        const timer = setTimeout(() => {
          setCurrentSubtitle('')
          setCurrentSpeaker(null)
        }, 3000)
        
        return () => clearTimeout(timer)
      }
    }
  }, [history])

  // アバターの状態を決定
  const getAvatarState = (): AvatarState => {
    if (connection === 'connecting') return 'thinking'
    if (connection !== 'connected') return 'idle'
    if (mic === 'recording' || recording) return 'listening'
    if (currentSpeaker === 'assistant') return 'speaking'
    return 'idle'
  }

  // アバターの感情を決定（メッセージ内容から推定）
  const getAvatarEmotion = (): AvatarEmotion => {
    if (history.length === 0) return 'neutral'
    
    const latestMessage = history[history.length - 1]
    if (latestMessage.role === 'assistant' && latestMessage.text) {
      const text = latestMessage.text.toLowerCase()
      
      // 簡単な感情推定
      if (text.includes('ありがとう') || text.includes('嬉しい') || text.includes('良い')) {
        return 'happy'
      }
      if (text.includes('すみません') || text.includes('申し訳') || text.includes('難しい')) {
        return 'concerned'
      }
      if (text.includes('？') || text.includes('what') || text.includes('なん')) {
        return 'surprised'
      }
      if (text.includes('考え') || text.includes('分析') || text.includes('検討')) {
        return 'focused'
      }
    }
    
    return 'neutral'
  }

  // 音声強度を模擬（実際のWebAudio APIから取得する場合はここを置き換え）
  useEffect(() => {
    let interval: number | undefined
    
    if (currentSpeaker === 'assistant' || (mic === 'recording' && recording)) {
      interval = setInterval(() => {
        setSpeechIntensity(Math.random() * 0.8 + 0.2) // 0.2-1.0の範囲
      }, 100)
    } else {
      setSpeechIntensity(0)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentSpeaker, mic, recording])

  return (
    <div className="flex h-full">
      {/* 左側: アバター */}
      <div className="w-80 bg-gradient-to-b from-blue-50 to-green-50 border-r border-gray-200 flex flex-col items-center justify-center p-6">
        <SimpleAvatar
          state={getAvatarState()}
          emotion={getAvatarEmotion()}
          speechIntensity={speechIntensity}
          isAnimated={true}
        />
        
        {/* 接続状態 */}
        <div className={cn(
          "mt-4 px-3 py-1 rounded-full text-xs font-medium",
          connection === 'connected' ? 'bg-green-100 text-green-700' :
          connection === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-700'
        )}>
          {connection === 'connected' && '🟢 接続中'}
          {connection === 'connecting' && '🟡 接続中...'}
          {connection === 'disconnected' && '🔴 未接続'}
        </div>
      </div>
      
      {/* 右側: 会話履歴 */}
      <div className="flex-1 flex flex-col">
        {/* 会話履歴エリア */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-2"
        >
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-4">👋</div>
                <div className="text-lg font-medium">こんにちは！</div>
                <div className="text-sm">マイクボタンを押して会話を始めましょう</div>
              </div>
            </div>
          ) : (
            history.map((message, index) => (
              <SpeechBubble
                key={`${message.timestamp}-${index}`}
                message={message}
                isLatest={index === history.length - 1}
                showTimestamp={true}
              />
            ))
          )}
        </div>
        
        {/* 現在の状態表示 */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
            {mic === 'recording' && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>録音中...</span>
              </div>
            )}
            {currentSpeaker === 'assistant' && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>AI が話しています...</span>
              </div>
            )}
            {connection !== 'connected' && (
              <div className="text-gray-400">
                接続してから会話を開始してください
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 字幕オーバーレイ */}
      <SubtitleDisplay
        text={currentSubtitle}
        speaker={currentSpeaker || 'assistant'}
        isVisible={!!currentSubtitle && !!currentSpeaker}
        position="bottom"
      />
    </div>
  )
}