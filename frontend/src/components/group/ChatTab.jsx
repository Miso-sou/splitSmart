import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket'
import { chatService } from '../../services/chat.service'
import ChatMessage from './ChatMessage'
import LoadingSpinner from '../shared/LoadingSpinner'
import { cn } from '../../lib/cn'

export default function ChatTab({ groupId, user }) {
  const { socket, joinGroup, sendMessage } = useSocket()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const containerRef = useRef(null)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Fetch history + join room
  useEffect(() => {
    if (!groupId) return

    setLoading(true)
    chatService.getMessages(groupId)
      .then((res) => {
        setMessages(res.data)
      })
      .catch((err) => {
        console.error('Failed to fetch messages:', err)
      })
      .finally(() => {
        setLoading(false)
      })

    joinGroup(groupId)
  }, [groupId, joinGroup])

  // Listen for new messages
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        // Deduplicate by _id
        if (prev.some((m) => m._id === msg._id)) return prev
        return [...prev, msg]
      })
    }

    socket.on('new-message', handleNewMessage)
    return () => socket.off('new-message', handleNewMessage)
  }, [socket])

  // Scroll on new messages or loading complete
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Auto-resize textarea
  const handleTextChange = (e) => {
    setText(e.target.value)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px'
    }
  }

  // Send text message
  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    sendMessage(groupId, { senderId: user._id, text: trimmed })
    setText('')
    setSending(false)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-1 py-3 scrollbar-thin"
      >
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <MessageCircle size={24} className="text-nav-inactive" />
            </div>
            <h3 className="text-base font-medium text-white mb-1.5">
              No messages yet
            </h3>
            <p className="text-sm text-muted text-center max-w-[240px] leading-relaxed">
              Say hi! Start the conversation with your group.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg._id}
                message={msg}
                isOwn={msg.sender?._id === user?._id}
              />
            ))}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-surface-border bg-[#0f1010] px-2 py-2">
        <div className="flex items-end gap-2">
          {/* Text input */}
          <div className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 ml-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-transparent text-sm text-white placeholder-muted resize-none outline-none leading-relaxed"
              style={{ maxHeight: '80px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors mb-0.5 mr-1',
              text.trim()
                ? 'bg-accent-green text-white'
                : 'bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
