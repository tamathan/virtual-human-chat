import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SubtitleDisplayProps } from '@/types'

export function SubtitleDisplay({ 
  text, 
  speaker, 
  isVisible, 
  position = 'bottom' 
}: SubtitleDisplayProps) {
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // タイプライター効果でテキストを表示
  useEffect(() => {
    if (!text || !isVisible) {
      setDisplayText('')
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    setDisplayText('')
    
    const chars = text.split('')
    let currentIndex = 0
    
    const timer = setInterval(() => {
      if (currentIndex < chars.length) {
        setDisplayText(prev => prev + chars[currentIndex])
        currentIndex++
      } else {
        setIsTyping(false)
        clearInterval(timer)
      }
    }, 30) // 30ms間隔でタイプ

    return () => clearInterval(timer)
  }, [text, isVisible])

  if (!isVisible || !text) {
    return null
  }

  const positionClasses = {
    top: 'top-4',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-4'
  }

  const speakerColors = {
    user: 'bg-blue-500/90 text-white border-blue-400',
    assistant: 'bg-green-500/90 text-white border-green-400'
  }

  return (
    <div className={cn(
      "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
      positionClasses[position],
      isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
    )}>
      <div className={cn(
        "px-6 py-3 rounded-lg border-2 shadow-lg backdrop-blur-sm",
        "max-w-2xl text-center font-medium",
        speakerColors[speaker]
      )}>
        <div className="text-xs opacity-80 mb-1">
          {speaker === 'user' ? '🎤 あなた' : '🤖 AI'}
        </div>
        <div className="text-lg leading-relaxed">
          {displayText}
          {isTyping && (
            <span className="inline-block w-0.5 h-6 bg-current ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}