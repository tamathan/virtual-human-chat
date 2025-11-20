import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { AvatarProps } from '@/types'

export function SimpleAvatar({ 
  state, 
  emotion, 
  speechIntensity, 
  isAnimated = true 
}: AvatarProps) {
  const [blinkPhase, setBlinkPhase] = useState(0)
  const [mouthPhase, setMouthPhase] = useState(0)

  // まばたきアニメーション
  useEffect(() => {
    if (!isAnimated) return
    
    const blinkInterval: ReturnType<typeof setInterval> = setInterval(() => {
      setBlinkPhase(prev => (prev + 1) % 100)
    }, 100)
    
    return () => clearInterval(blinkInterval)
  }, [isAnimated])

  // 口の動きアニメーション（話している時）
  useEffect(() => {
    if (!isAnimated || state !== 'speaking') {
      setMouthPhase(0)
      return
    }
    
    const mouthInterval: ReturnType<typeof setInterval> = setInterval(() => {
      setMouthPhase(prev => (prev + 1) % 4)
    }, 200 - (speechIntensity * 100)) // 音声強度で速度調整
    
    return () => clearInterval(mouthInterval)
  }, [isAnimated, state, speechIntensity])

  // 表情に基づく目の形
  const getEyeStyle = () => {
    const isBlinking = blinkPhase > 95 // 95-99で瞬き
    
    if (isBlinking) return 'w-1 h-1' // 目を閉じる
    
    switch (emotion) {
      case 'happy':
        return 'w-3 h-3 rounded-full' // 丸い目
      case 'surprised':
        return 'w-4 h-4 rounded-full' // 大きな目
      case 'concerned':
        return 'w-2.5 h-3 rounded-full' // 少し細い目
      case 'focused':
        return 'w-3 h-2 rounded-full' // 集中した目
      default:
        return 'w-3 h-3 rounded-full' // 通常の目
    }
  }

  // 表情に基づく眉毛の位置
  const getEyebrowStyle = () => {
    switch (emotion) {
      case 'surprised':
        return 'top-4' // 眉を上げる
      case 'concerned':
        return 'top-6 rotate-12' // 困った表情
      case 'focused':
        return 'top-5 -rotate-6' // 集中した表情
      default:
        return 'top-5' // 通常位置
    }
  }

  // 状態に基づく口の形
  const getMouthStyle = () => {
    switch (state) {
      case 'speaking': {
        const mouthShapes = [
          'w-4 h-2 rounded-full', // あ
          'w-2 h-3 rounded-full', // い
          'w-3 h-3 rounded-full', // う
          'w-4 h-1 rounded-full'  // え
        ]
        return mouthShapes[mouthPhase]
      }
      
      case 'listening':
        return 'w-2 h-2 rounded-full' // 小さく開いた口
      
      case 'thinking':
        return 'w-3 h-1 rounded-full' // 考えている口
      
      default:
        return emotion === 'happy' 
          ? 'w-4 h-2 rounded-b-full border-t-2' // 笑顔
          : 'w-3 h-1 rounded-full' // 通常
    }
  }

  // 状態に基づく色
  const getAvatarColor = () => {
    switch (state) {
      case 'listening':
        return 'from-blue-300 to-blue-500' // 聞いている時は青
      case 'speaking':
        return 'from-green-300 to-green-500' // 話している時は緑
      case 'thinking':
        return 'from-yellow-300 to-yellow-500' // 考えている時は黄色
      default:
        return 'from-gray-300 to-gray-500' // アイドル時はグレー
    }
  }

  // パルス効果（録音中など）
  const getPulseEffect = () => {
    if (state === 'listening') return 'animate-pulse'
    if (state === 'speaking' && speechIntensity > 0.3) return 'animate-bounce'
    return ''
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* アバター本体 */}
      <div className={cn(
        "relative w-32 h-32 rounded-full bg-gradient-to-br shadow-lg",
        "border-4 border-white transition-all duration-300",
        getAvatarColor(),
        getPulseEffect()
      )}>
        {/* 顔のベース */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-b from-pink-100 to-pink-200">
          
          {/* 眉毛 */}
          <div className={cn(
            "absolute left-6 w-4 h-1 bg-gray-600 rounded-full transition-all duration-200",
            getEyebrowStyle()
          )} />
          <div className={cn(
            "absolute right-6 w-4 h-1 bg-gray-600 rounded-full transition-all duration-200",
            getEyebrowStyle()
          )} />
          
          {/* 目 */}
          <div className={cn(
            "absolute left-7 top-8 bg-gray-800 transition-all duration-150",
            getEyeStyle()
          )} />
          <div className={cn(
            "absolute right-7 top-8 bg-gray-800 transition-all duration-150",
            getEyeStyle()
          )} />
          
          {/* 鼻 */}
          <div className="absolute left-1/2 top-12 -translate-x-1/2 w-1 h-2 bg-pink-300 rounded-full" />
          
          {/* 口 */}
          <div className={cn(
            "absolute left-1/2 top-16 -translate-x-1/2 bg-red-400 transition-all duration-100",
            getMouthStyle(),
            emotion === 'happy' ? 'border-red-400' : ''
          )} />
          
          {/* ほっぺた（感情によって変化） */}
          {emotion === 'happy' && (
            <>
              <div className="absolute left-3 top-12 w-3 h-3 bg-pink-300 rounded-full opacity-60" />
              <div className="absolute right-3 top-12 w-3 h-3 bg-pink-300 rounded-full opacity-60" />
            </>
          )}
        </div>
        
        {/* 状態インジケーター */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-white rounded-full shadow-md">
          <div className="flex items-center space-x-1">
            {state === 'listening' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />}
            {state === 'speaking' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            {state === 'thinking' && (
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            {state === 'idle' && <div className="w-2 h-2 bg-gray-400 rounded-full" />}
          </div>
        </div>
      </div>
      
      {/* 状態テキスト */}
      <div className="text-center">
        <div className="text-sm font-medium text-gray-700">
          {state === 'idle' && '待機中'}
          {state === 'listening' && '👂 聞いています'}
          {state === 'speaking' && '💬 話しています'}
          {state === 'thinking' && '🤔 考え中'}
        </div>
        {speechIntensity > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            音量: {Math.round(speechIntensity * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}