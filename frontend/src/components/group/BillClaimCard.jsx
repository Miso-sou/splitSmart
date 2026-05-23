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
  const { socket, emit } = useSocket()
  
  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Track newly selected items by the current user (itemId -> quantity)
  const [selectedItems, setSelectedItems] = useState({})

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

  // We only consider an item fully claimed if all NON-TAX items have an assignedTo
  const nonTaxItems = items.filter(i => !isTaxItem(i.name))
  const allClaimed = nonTaxItems.length > 0 && nonTaxItems.every(i => i.assignedTo)

  const myClaimedTotal = nonTaxItems
    .filter(i => i.assignedTo?._id === user?._id)
    .reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0)

  // Calculate tax distribution for live preview
  let totalTaxAmount = 0
  const currentParticipants = new Set()
  
  items.forEach(i => {
    if (isTaxItem(i.name)) {
      totalTaxAmount += (i.price * (i.quantity || 1))
    } else if (i.assignedTo) {
      currentParticipants.add(i.assignedTo._id || i.assignedTo)
    }
  })

  const handleToggleSelect = (item) => {
    setSelectedItems(prev => {
      const updated = { ...prev }
      if (updated[item._id]) {
        delete updated[item._id]
      } else {
        updated[item._id] = item.quantity || 1
      }
      return updated
    })
  }

  const handleUpdateQuantity = (itemId, newQty) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: newQty
    }))
  }

  const handleConfirm = async () => {
    const itemsToClaim = Object.entries(selectedItems)
    if (itemsToClaim.length === 0 || submitting) return

    setSubmitting(true)
    try {
      for (const [itemId, qty] of itemsToClaim) {
        await api.post(`/api/expense/${expense._id}/items/${itemId}/claim`, {
          quantity: qty
        })
      }
      
      // Clear selection
      setSelectedItems({})
      
      // Emit socket event to notify others
      if (socket) {
        socket.emit('item-claimed', { groupId: expense.group, expenseId: expense._id })
      }
      
      // Refetch for ourselves
      await fetchExpense()
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(err.response.data.message || "Item was modified. Please try again.")
        setSelectedItems({})
        await fetchExpense()
      } else {
        toast.error(err.response?.data?.message || "Failed to claim items")
        console.error("Failed to claim items", err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTotal = Object.entries(selectedItems).reduce((sum, [id, qty]) => {
    const item = items.find(i => i._id === id)
    if (!item || isTaxItem(item.name)) return sum
    return sum + (item.price * qty)
  }, 0)

  let participantCount = currentParticipants.size
  const isCurrentlyParticipating = currentParticipants.has(user?._id)
  if (selectedTotal > 0 && !isCurrentlyParticipating) {
    participantCount += 1
  }

  const taxPerPerson = participantCount > 0 ? (totalTaxAmount / participantCount) : 0
  const myTaxShare = (isCurrentlyParticipating || selectedTotal > 0) ? taxPerPerson : 0

  const displayTotal = myClaimedTotal + selectedTotal + myTaxShare

  return (
    <div className="bg-surface border border-surface-border rounded-xl overflow-hidden w-full max-w-sm mt-1">
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
            Paid by {formatUsername(expense.paidBy)}{expense.paidBy._id === user?._id ? ' (you)' : ''}
          </p>
          <span className={cn(
            "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full",
            allClaimed 
              ? "bg-[rgba(34,197,94,0.12)] text-accent-green" 
              : "bg-[rgba(234,179,8,0.12)] text-yellow-500"
          )}>
            {allClaimed ? "Finalized" : "Open"}
          </span>
        </div>
      </div>

      {/* Item List */}
      <div className="p-2 space-y-1">
        {items.map(item => {
          const isTax = isTaxItem(item.name)
          const isAssignedToMe = !isTax && item.assignedTo?._id === user?._id
          const isAssigned = !isTax && !!item.assignedTo
          const isSelectedByMe = !isTax && !!selectedItems[item._id]
          const selectedQty = selectedItems[item._id] || item.quantity || 1
          const displayQty = isSelectedByMe ? selectedQty : (item.quantity || 1)
          const subtotal = item.price * displayQty
          
          return (
            <div 
              key={item._id}
              onClick={() => {
                if (!isTax && !isAssigned && !allClaimed) {
                  handleToggleSelect(item)
                }
              }}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                !isTax && !isAssigned && !allClaimed ? "cursor-pointer hover:bg-[#252525]" : "",
                isSelectedByMe ? "bg-[rgba(255,255,255,0.04)]" : ""
              )}
            >
              {/* Custom Radio Button */}
              <div className={cn(
                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                isTax
                  ? "border-[#3a3a3a] opacity-50"
                  : isAssignedToMe 
                    ? "border-accent-green bg-[rgba(34,197,94,0.12)]" 
                    : isSelectedByMe
                      ? "border-accent-green"
                      : isAssigned
                        ? "border-[#3a3a3a] bg-[#1a1a1a]"
                        : "border-[#4b5563]"
              )}>
                {(isAssignedToMe || isSelectedByMe) && !isTax && (
                  <div className="w-2 h-2 rounded-full bg-accent-green" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white truncate">
                      {item.name}
                    </p>
                    {!isAssignedToMe && !isAssigned && isSelectedByMe && (item.quantity > 1) ? (
                      <div className="flex items-center bg-[#1a1a1a] rounded-md border border-white/[0.04]" onClick={(e) => e.stopPropagation()}>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateQuantity(item._id, Math.max(1, selectedQty - 1))}
                          className="w-5 h-5 flex items-center justify-center text-[#6b7280] hover:text-white"
                        >-</button>
                        <span className="w-4 text-center text-xs text-white">{selectedQty}</span>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateQuantity(item._id, Math.min(item.quantity, selectedQty + 1))}
                          className="w-5 h-5 flex items-center justify-center text-[#6b7280] hover:text-white"
                        >+</button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#6b7280]">×{item.quantity || 1}</span>
                    )}
                  </div>
                  <span className="text-sm text-white shrink-0">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>
                
                {/* Assignment Status */}
                <div className="mt-0.5">
                  {isTax ? (
                    <span className="text-xs text-[#6b7280]">Auto-split</span>
                  ) : isAssignedToMe ? (
                    <span className="text-xs text-accent-green">You</span>
                  ) : isAssigned ? (
                    <span className="text-xs text-[#6b7280]">
                      {formatUsername(item.assignedTo)}
                    </span>
                  ) : (
                    <span className="text-xs text-danger/80">Unclaimed</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.04] bg-[#1a1a1a]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#6b7280]">Your items</span>
          <span className="text-sm font-medium text-white">₹{displayTotal.toFixed(2)}</span>
        </div>
        
        {allClaimed ? (
          <div className="w-full py-2.5 text-center rounded-lg bg-[#252525] text-sm font-medium text-[#6b7280]">
            All items claimed
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={Object.keys(selectedItems).length === 0 || submitting}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
              Object.keys(selectedItems).length > 0 && !submitting
                ? "bg-accent-green text-white hover:bg-accent-green-dark"
                : "bg-[#252525] text-[#4b5563] cursor-not-allowed"
            )}
          >
            {submitting ? "Claiming..." : "Confirm"}
          </button>
        )}
      </div>
    </div>
  )
}
