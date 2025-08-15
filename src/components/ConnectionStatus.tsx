import { useChatStore } from '@/store/chat-store'
import { cn } from '@/lib/utils'

export function ConnectionStatus() {
  const { connection, mic, playback } = useChatStore()

  const getStatusColor = () => {
    switch (connection) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      default:
        return 'bg-red-500'
    }
  }

  const getStatusText = () => {
    if (playback === 'playing') return 'Playing'
    if (mic === 'connecting') return 'Connecting to microphone'
    if (mic === 'recording') return 'Recording'
    if (connection === 'connecting') return 'Connecting'
    if (connection === 'connected') return 'Connected'
    return 'Disconnected'
  }

  return (
    <div className="flex items-center gap-2 p-4 bg-card border-b">
      <div 
        className={cn(
          'w-3 h-3 rounded-full animate-pulse',
          getStatusColor()
        )}
      />
      <span className="text-sm font-medium">{getStatusText()}</span>
    </div>
  )
}