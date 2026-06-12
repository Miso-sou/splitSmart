import { useState } from 'react'
import { X, Reply } from 'lucide-react'
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

export default function ChatMessage({ message, isOwn, onReply }) {
  const [showFullImage, setShowFullImage] = useState(false)

  const handleScrollToOriginal = (replyTo) => {
    if (!replyTo) return
    const element = document.getElementById(`msg-${replyTo._id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('glow-highlight')
      setTimeout(() => {
        element.classList.remove('glow-highlight')
      }, 1500)
    }
  }

  const QuoteBlock = ({ replyTo }) => {
    if (!replyTo) return null
    const senderName = replyTo.sender?.username || 'User'
    let previewText = replyTo.text
    if (replyTo.expenseId) {
      previewText = replyTo.text || '📋 Bill Split'
    } else if (replyTo.imageUrl) {
      previewText = replyTo.text ? `📷 ${replyTo.text}` : '📷 Image'
    }

    return (
      <div 
        onClick={() => handleScrollToOriginal(replyTo)}
        className="mb-1.5 p-2 rounded bg-white/[0.04] border-l-2 border-accent-green cursor-pointer hover:bg-white/[0.08] transition-colors text-left text-xs max-w-full"
      >
        <p className="font-semibold text-accent-green text-[11px] truncate">
          {senderName}
        </p>
        <p className="text-[#9ca3af] truncate mt-0.5">
          {previewText}
        </p>
      </div>
    )
  }

  return (
    <>
      <div 
        id={`msg-${message._id}`}
        className={cn('flex mb-3 group relative items-center gap-2 max-w-[85%]', isOwn ? 'justify-end ml-auto' : 'justify-start mr-auto')}
      >
        {/* Reply Button on hover (For own message, rendered to the left) */}
        {isOwn && onReply && (
          <button
            onClick={() => onReply(message)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-[#252525] border border-white/[0.06] text-[#6b7280] hover:text-white transition-all duration-150 shadow-md cursor-pointer shrink-0"
            title="Reply"
          >
            <Reply size={14} />
          </button>
        )}

        <div className={cn('max-w-full min-w-[80px]')}>
          {/* Sender name — only for other users */}
          {!isOwn && message.sender?.username && (
            <p className="text-xs text-muted mb-1 px-1">
              {message.sender.username}
            </p>
          )}

          {/* Bubble or Card wrapper */}
          {message.expenseId ? (
            <div className="relative">
              <QuoteBlock replyTo={message.replyTo} />
              <BillClaimCard message={message} />
            </div>
          ) : (
            <div
              className={cn(
                'rounded-lg px-3 py-2',
                isOwn
                  ? 'bg-[rgba(34,197,94,0.12)]'
                  : 'bg-surface border border-surface-border'
              )}
            >
              <QuoteBlock replyTo={message.replyTo} />

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
          )}

          {/* Timestamp */}
          <p className={cn(
            'text-[11px] text-muted mt-1 px-1',
            isOwn ? 'text-right' : 'text-left'
          )}>
            {formatTime(message.createdAt)}
          </p>
        </div>

        {/* Reply Button on hover (For other user's message, rendered to the right) */}
        {!isOwn && onReply && (
          <button
            onClick={() => onReply(message)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-[#252525] border border-white/[0.06] text-[#6b7280] hover:text-white transition-all duration-150 shadow-md cursor-pointer shrink-0"
            title="Reply"
          >
            <Reply size={14} />
          </button>
        )}
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
