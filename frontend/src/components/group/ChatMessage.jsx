import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import BillClaimCard from './BillClaimCard'

function formatTime(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function ChatMessage({ message, isOwn }) {
  const [showFullImage, setShowFullImage] = useState(false)

  if (message.expenseId) {
    return (
      <div className={cn('flex mb-3', isOwn ? 'justify-end' : 'justify-start')}>
        <BillClaimCard message={message} />
      </div>
    )
  }

  return (
    <>
      <div className={cn('flex mb-3', isOwn ? 'justify-end' : 'justify-start')}>
        <div className={cn('max-w-[75%] min-w-[80px]')}>
          {/* Sender name — only for other users */}
          {!isOwn && message.sender?.username && (
            <p className="text-xs text-muted mb-1 px-1">
              {message.sender.username}
            </p>
          )}

          {/* Bubble */}
          <div
            className={cn(
              'rounded-lg px-3 py-2',
              isOwn
                ? 'bg-[rgba(34,197,94,0.12)]'
                : 'bg-surface border border-surface-border'
            )}
          >
            {/* Image thumbnail */}
            {message.imageUrl && (
              <button
                onClick={() => setShowFullImage(true)}
                className="block mb-1.5 rounded-lg overflow-hidden max-w-[240px]"
              >
                <img
                  src={message.imageUrl}
                  alt="Shared image"
                  className="w-full h-auto object-cover rounded-lg"
                  loading="lazy"
                />
              </button>
            )}

            {/* Text */}
            {message.text && (
              <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">
                {message.text}
              </p>
            )}
          </div>

          {/* Timestamp */}
          <p className={cn(
            'text-[11px] text-muted mt-1 px-1',
            isOwn ? 'text-right' : 'text-left'
          )}>
            {formatTime(message.createdAt)}
          </p>
        </div>
      </div>

      {/* Full-screen image viewer */}
      {showFullImage && message.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#252525] flex items-center justify-center hover:bg-[#2e2e2e] transition-colors z-10"
          >
            <X size={20} className="text-white" />
          </button>
          <img
            src={message.imageUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
