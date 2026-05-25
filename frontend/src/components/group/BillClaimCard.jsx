import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import api from '../../api/axios'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import { formatUsername } from '../../utils/format'
import { cn } from '../../lib/cn'
import toast from 'react-hot-toast'

export default function BillClaimCard({ message }) {
  const { user } = useAuth()
  const { socket } = useSocket()
  
  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submittingItemId, setSubmittingItemId] = useState(null)

  const fetchExpense = async () => {
    try {
      const res = await api.get(`/api/expense/${message.expenseId}`)
      setExpense(res.data)
    } catch (err) {
      console.error("Failed to load expense for bill card", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (message.expenseId) {
      fetchExpense()
    }
  }, [message.expenseId])

  useEffect(() => {
    if (!socket || !expense) return

    const handleItemClaimed = ({ expenseId }) => {
      if (expenseId === expense._id) {
        fetchExpense()
      }
    }

    socket.on('item-claimed', handleItemClaimed)
    return () => socket.off('item-claimed', handleItemClaimed)
  }, [socket, expense])

  if (loading) {
    return (
      <div className="bg-surface border border-surface-border rounded-xl p-4 w-full max-w-sm flex justify-center mt-1">
        <Loader2 size={24} className="text-muted animate-spin" />
      </div>
    )
  }

  if (!expense) return null

  const items = expense.items || []
  
  const TAX_KEYWORDS = ['tax', 'gst', 'vat', 'service charge', 'cess']
  const isTaxItem = (name) => TAX_KEYWORDS.some(k => name.toLowerCase().includes(k))

  const nonTaxItems = items.filter(i => !isTaxItem(i.name))

  // A bill is fully finalized if every non-tax item has at least one claimer
  const allClaimed = nonTaxItems.length > 0 && nonTaxItems.every(i => (i.claims || []).length > 0)

  // Handle toggle claim (used for qty=1 toggle, or starting a claim for qty>1)
  const handleItemToggle = async (itemId, isCurrentlyClaimed) => {
    if (submittingItemId !== null) return
    setSubmittingItemId(itemId)
    
    try {
      if (isCurrentlyClaimed) {
        // Unclaim it completely
        await api.delete(`/api/expense/${expense._id}/items/${itemId}/claim`)
      } else {
        // Claim 1 quantity
        await api.post(`/api/expense/${expense._id}/items/${itemId}/claim`, { quantity: 1 })
      }

      // Emit socket event to notify other clients in the group
      if (socket) {
        socket.emit('item-claimed', { groupId: expense.group, expenseId: expense._id })
      }

      // Refresh
      await fetchExpense()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update item claim")
      await fetchExpense()
    } finally {
      setSubmittingItemId(null)
    }
  }

  // Handle portion quantity change for qty > 1 items
  const handleQuantityChange = async (itemId, newQty) => {
    if (submittingItemId !== null) return
    setSubmittingItemId(itemId)
    
    try {
      await api.post(`/api/expense/${expense._id}/items/${itemId}/claim`, { quantity: newQty })

      if (socket) {
        socket.emit('item-claimed', { groupId: expense.group, expenseId: expense._id })
      }

      await fetchExpense()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update quantity")
      await fetchExpense()
    } finally {
      setSubmittingItemId(null)
    }
  }

  // Get the exact user split share amount calculated by the backend (including tax and rounding splits)
  const mySplit = expense.splits.find(s => 
    s.user?._id?.toString() === user?._id?.toString() || 
    s.user?.toString() === user?._id?.toString()
  )
  const displayTotal = mySplit ? mySplit.amount : 0

  return (
    <div className="bg-surface border border-surface-border rounded-xl overflow-hidden w-full max-w-sm mt-1 shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04] bg-[#1a1a1a]">
        <div className="flex items-start justify-between mb-1">
          <h4 className="text-[15px] font-medium text-white truncate mr-2">
            {expense.description}
          </h4>
          <span className="text-[15px] font-medium text-white shrink-0">
            ₹{expense.totalAmount.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-[#6b7280]">
            Paid by {formatUsername(expense.paidBy)}{expense.paidBy?._id?.toString() === user?._id?.toString() ? ' (you)' : ''}
          </p>
          <span className={cn(
            "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full",
            allClaimed 
              ? "bg-[rgba(34,197,94,0.12)] text-accent-green" 
              : "bg-[rgba(234,179,8,0.12)] text-yellow-500"
          )}>
            {allClaimed ? "All Claimed" : "Open"}
          </span>
        </div>
      </div>

      {/* Item List */}
      <div className="p-2 space-y-1">
        {items.map(item => {
          const isTax = isTaxItem(item.name)
          const claims = item.claims || []
          
          const myClaim = claims.find(c => c.user?._id?.toString() === user?._id?.toString())
          const isClaimedByMe = !!myClaim
          const myClaimedQty = myClaim ? myClaim.quantity : 0
          
          const claimersCount = claims.length
          const totalCost = item.price * item.quantity
          const isSubmitting = submittingItemId === item._id

          // Helper to trigger instant toggling for qty = 1 (or tap to start claiming for qty > 1)
          const handleRowClick = () => {
            if (isTax || isSubmitting) return
            handleItemToggle(item._id, isClaimedByMe)
          }

          return (
            <div 
              key={item._id}
              onClick={handleRowClick}
              className={cn(
                "flex flex-col gap-1 p-2.5 rounded-lg transition-all duration-150",
                !isTax ? "cursor-pointer hover:bg-[#252525]" : "opacity-80 bg-[#121212]/40",
                isClaimedByMe ? "bg-[rgba(34,197,94,0.03)] border-l-2 border-accent-green" : "",
                isSubmitting ? "opacity-60 cursor-wait" : ""
              )}
            >
              <div className="flex items-center gap-3">
                {/* Custom Checkbox/Indicator */}
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                  isTax
                    ? "border-[#3a3a3a] opacity-50 bg-[#121212]"
                    : isClaimedByMe 
                      ? "border-accent-green bg-[rgba(34,197,94,0.12)]" 
                      : "border-[#4b5563] bg-transparent"
                )}>
                  {isClaimedByMe && !isTax && (
                    <div className="w-2 h-2 rounded-full bg-accent-green" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        isClaimedByMe ? "text-white" : "text-[#d1d5db]"
                      )}>
                        {item.name}
                      </p>
                      {item.quantity > 1 && (
                        <span className="text-xs text-[#6b7280]">×{item.quantity}</span>
                      )}
                      
                      {isSubmitting && (
                        <Loader2 size={12} className="text-accent-green animate-spin" />
                      )}
                    </div>
                    
                    {/* Item cost and split breakdown */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <span className="text-sm font-medium text-white">
                        ₹{totalCost.toFixed(2)}
                      </span>
                      {!isTax && (
                        item.quantity === 1 ? (
                          claimersCount > 1 && (
                            <span className="text-[10px] text-accent-green/80 font-medium">
                              ₹{(totalCost / claimersCount).toFixed(2)} each
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-[#6b7280]">
                            ₹{item.price.toFixed(2)} each
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  
                  {/* Claim Metadata / Names list / Stepper */}
                  <div className="mt-1.5 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {isTax ? (
                        <span className="text-[10px] text-[#6b7280] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-white/[0.02]">
                          Divided equally among everyone who claims
                        </span>
                      ) : (
                        <>
                          {/* List all claimers */}
                          {claims.map((c, idx) => {
                            const isMe = c.user?._id?.toString() === user?._id?.toString()
                            return (
                              <span 
                                key={idx} 
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1",
                                  isMe 
                                    ? "font-medium text-accent-green bg-[rgba(34,197,94,0.08)] border-accent-green/20"
                                    : "text-[#9ca3af] bg-[#222222] border-white/[0.04]"
                                )}
                              >
                                {isMe ? 'You' : formatUsername(c.user)}
                                {item.quantity > 1 && ` ×${c.quantity}`}
                              </span>
                            )
                          })}

                          {/* Unclaimed indicator */}
                          {claimersCount === 0 && (
                            <span className="text-[10px] text-yellow-500 bg-[rgba(234,179,8,0.06)] px-2 py-0.5 rounded-full border border-yellow-500/10">
                              Unclaimed
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Quantity Stepper for Quantity > 1 (Only visible if claimed by me) */}
                    {isClaimedByMe && item.quantity > 1 && !isTax && (
                      <div 
                        className="flex items-center bg-[#1a1a1a] rounded-lg border border-white/[0.06] py-0.5 px-1 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()} // Prevent triggering toggler on container click
                      >
                        <button 
                          type="button" 
                          disabled={isSubmitting}
                          onClick={() => {
                            if (myClaimedQty > 1) {
                              handleQuantityChange(item._id, myClaimedQty - 1)
                            } else {
                              handleItemToggle(item._id, true) // Unclaim completely
                            }
                          }}
                          className="w-6 h-5 flex items-center justify-center text-[#9ca3af] hover:text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-white">
                          {myClaimedQty}
                        </span>
                        <button 
                          type="button" 
                          disabled={isSubmitting}
                          onClick={() => {
                            // Find remaining quantity across other claims
                            const otherClaimsQty = claims
                              .filter(c => c.user?._id?.toString() !== user?._id?.toString())
                              .reduce((sum, c) => sum + c.quantity, 0)
                            const remaining = item.quantity - otherClaimsQty
                            
                            if (myClaimedQty < remaining) {
                              handleQuantityChange(item._id, myClaimedQty + 1)
                            } else {
                              toast.error(`Cannot claim more than remaining quantity (${remaining - myClaimedQty} left)`)
                            }
                          }}
                          className="w-6 h-5 flex items-center justify-center text-[#9ca3af] hover:text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.04] bg-[#1a1a1a]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs text-[#9ca3af]">Your split share (incl. tax)</span>
          <span className="text-base font-semibold text-accent-green">
            ₹{displayTotal.toFixed(2)}
          </span>
        </div>
        
        <p className="text-[10px] text-[#6b7280] text-center italic mt-1.5">
          Tap items to claim. For multi-quantity items, use the stepper to adjust your portion.
        </p>
      </div>
    </div>
  )
}
