# Fix Item-Based Bill Claiming Feature (Revised)

This plan fixes the item-based split claiming feature in SplitSmart. By changing the data model from fragile item-splitting (creating new sub-documents) to a clean, multi-user `claims[]` array under each item, we solve the race conditions, confirm button crashes, and enable robust real-time unclaiming.

---

## User Review Required

> [!IMPORTANT]
> **Schema Migration details:**
> - **Before**: `items: [{ name, price, quantity, assignedTo: ObjectId }]` (splitting items upon partial claim)
> - **After**: `items: [{ name, price, quantity, claims: [{ user: ObjectId, quantity: Number }] }]` (one item, multiple claims)
> 
> Any existing item-based expenses in the database will need to be recreated or they will fail to load claims properly since they don't conform to the new schema format. This is typical and acceptable for the development environment.

> [!NOTE]
> **Who owns unclaimed items?**
> In item-based splits, any unclaimed items do not generate any splits.
> Since the payer's total paid is `expense.totalAmount` and the sum of all users' `splits.amount` only covers the claimed items, the remaining unclaimed cost is implicitly absorbed by the payer. This means the payer effectively "owns" and pays for all unclaimed items until someone else claims them. Once claimed, splits are updated, and the debt is transferred to the claimer.
>
> On the frontend `BillClaimCard`, we show "Your items" which is `myClaimedTotal + selectedTotal + myTaxShare`. The card header shows the `expense.totalAmount` of the whole bill.

> [!NOTE]
> **Socket Flow Clarification:**
> The flow uses the established codebase pattern:
> 1. Frontend makes HTTP call (POST `/claim` or DELETE `/claim`).
> 2. Once the API call resolves successfully, the frontend emits a socket event `'item-claimed'` to the server.
> 3. The backend socket handler `handlers.js` relays this event to all other clients in the group room via `socket.to(groupId).emit('item-claimed', { expenseId })`.
> 4. Other clients receive the event and trigger a re-fetch of the expense, updating their UIs in real time.

---

## Proposed Changes

### 1. Database Model Schema Migration

#### [MODIFY] [expense.model.js](file:///d:/Coding/MERN/splitsmart/backend/models/expense.model.js)

Update the `items` subschema to support `claims`:
```javascript
    items: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true }, // price per unit
        quantity: { type: Number, default: 1, min: 1 }, // total quantity
        claims: [
          {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            quantity: { type: Number, required: true, min: 1 }
          }
        ]
      }
    ],
```

---

### 2. Frontend AddExpense Form Support

#### [MODIFY] [AddExpense.jsx](file:///d:/Coding/MERN/splitsmart/frontend/src/pages/AddExpense.jsx)

Initialize empty claims array on new item-based expenses (and consistency on other splits):
```javascript
        items: splitType === 'item-based' 
          ? items.map(i => ({ name: i.name.trim(), price: parseFloat(i.price) || 0, quantity: parseInt(i.quantity) || 1, claims: [] }))
          : [{ name: title.trim(), price: parsedAmount, quantity: 1, claims: [] }]
```

---

### 3. Backend Controllers: OCC Claim, Unclaim, Sync Splits

#### [MODIFY] [expense.controller.js](file:///d:/Coding/MERN/splitsmart/backend/controllers/expense.controller.js)

1. Rewrite `claimItem` with an Optimistic Concurrency Control (OCC) retry loop with a jitter backoff delay and dynamic casting of split users to `mongoose.Types.ObjectId`.
2. Add `unclaimItem` using the same OCC retry loop and jitter delay.
3. Import `mongoose` at the top of the file to support ObjectId instantiation.
4. Update `getExpenseById` and `claimItem` / `unclaimItem` responses to populate `items.claims.user`.

```javascript
import mongoose from "mongoose";
// ... (existing imports)

// Synchronous helper to calculate splits from items array
const calculateSplits = (items) => {
    const TAX_KEYWORDS = ['tax', 'gst', 'vat', 'service charge', 'cess'];
    const isTaxItem = (name) => TAX_KEYWORDS.some(k => name.toLowerCase().includes(k));

    let totalTaxAmount = 0;
    const userSplitTotals = {};
    const participants = new Set();

    items.forEach(i => {
        if (isTaxItem(i.name)) {
            totalTaxAmount += (i.price * (i.quantity || 1));
        } else {
            i.claims.forEach(c => {
                const uid = c.user.toString();
                if (!userSplitTotals[uid]) userSplitTotals[uid] = 0;
                userSplitTotals[uid] += (i.price * c.quantity);
                participants.add(uid);
            });
        }
    });

    const participantCount = participants.size;
    const taxPerPerson = participantCount > 0 ? (totalTaxAmount / participantCount) : 0;

    return Object.keys(userSplitTotals).map(userId => ({
        user: new mongoose.Types.ObjectId(userId), // Cast as ObjectId so Mongoose populates correctly
        amount: Math.round((userSplitTotals[userId] + taxPerPerson) * 100) / 100
    }));
};

// Rewrite claimItem with OCC and Jitter
export const claimItem = asyncHandler(async (req, res) => {
    const { id: expenseId, itemId } = req.params;
    const requestedQuantity = parseInt(req.body.quantity) || 1;

    if (requestedQuantity <= 0) {
        throw new ApiError(400, "Quantity must be at least 1");
    }

    let retries = 3;
    while (retries > 0) {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            throw new ApiError(404, "Expense not found");
        }

        const group = await Group.findById(expense.group);
        const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            throw new ApiError(403, "You are not a member of this group");
        }

        const item = expense.items.find(i => i._id.toString() === itemId);
        if (!item) {
            throw new ApiError(404, "Item not found");
        }

        const otherClaimsQty = item.claims
            .filter(c => c.user.toString() !== req.user._id.toString())
            .reduce((sum, c) => sum + c.quantity, 0);

        const remainingQty = item.quantity - otherClaimsQty;
        if (requestedQuantity > remainingQty) {
            throw new ApiError(400, `Cannot claim more than remaining quantity (${remainingQty})`);
        }

        const myClaimIndex = item.claims.findIndex(c => c.user.toString() === req.user._id.toString());
        if (myClaimIndex >= 0) {
            item.claims[myClaimIndex].quantity = requestedQuantity;
        } else {
            item.claims.push({
                user: req.user._id,
                quantity: requestedQuantity
            });
        }

        const newSplits = calculateSplits(expense.items);
        const currentVersion = expense.__v || 0;

        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: expenseId, __v: currentVersion },
            {
                $set: {
                    items: expense.items,
                    splits: newSplits
                },
                $inc: { __v: 1 }
            },
            { new: true }
        );

        if (updatedExpense) {
            const finalExpense = await Expense.findById(expenseId)
                .populate("paidBy", "username avatar isGuest")
                .populate("splits.user", "username avatar isGuest")
                .populate("items.claims.user", "username avatar isGuest")
                .populate("createdBy", "username avatar isGuest");
            return res.json(finalExpense);
        }

        // Concurrency backoff jitter
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        retries--;
    }

    throw new ApiError(409, "Conflict: The expense was updated by another user. Please try again.");
});

// Add unclaimItem with OCC and Jitter
export const unclaimItem = asyncHandler(async (req, res) => {
    const { id: expenseId, itemId } = req.params;

    let retries = 3;
    while (retries > 0) {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            throw new ApiError(404, "Expense not found");
        }

        const group = await Group.findById(expense.group);
        const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            throw new ApiError(403, "You are not a member of this group");
        }

        const item = expense.items.find(i => i._id.toString() === itemId);
        if (!item) {
            throw new ApiError(404, "Item not found");
        }

        item.claims = item.claims.filter(c => c.user.toString() !== req.user._id.toString());

        const newSplits = calculateSplits(expense.items);
        const currentVersion = expense.__v || 0;

        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: expenseId, __v: currentVersion },
            {
                $set: {
                    items: expense.items,
                    splits: newSplits
                },
                $inc: { __v: 1 }
            },
            { new: true }
        );

        if (updatedExpense) {
            const finalExpense = await Expense.findById(expenseId)
                .populate("paidBy", "username avatar isGuest")
                .populate("splits.user", "username avatar isGuest")
                .populate("items.claims.user", "username avatar isGuest")
                .populate("createdBy", "username avatar isGuest");
            return res.json(finalExpense);
        }

        // Concurrency backoff jitter
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        retries--;
    }

    throw new ApiError(409, "Conflict: The expense was updated. Please try again.");
});
```

#### [MODIFY] Update `getExpenseById` in [expense.controller.js](file:///d:/Coding/MERN/splitsmart/backend/controllers/expense.controller.js)

Update populate paths to populate claims users:
```javascript
export const getExpenseById = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id)
        .populate("paidBy", "username avatar isGuest")
        .populate("splits.user", "username avatar isGuest")
        .populate("items.claims.user", "username avatar isGuest")
        .populate("createdBy", "username avatar isGuest");
    ...
```

---

### 4. Backend Express Routes

#### [MODIFY] [expense.routes.js](file:///d:/Coding/MERN/splitsmart/backend/routes/expense.routes.js)

Add DELETE claim route and import `unclaimItem`:
```javascript
import {
  ...
  claimItem,
  unclaimItem,
} from "../controllers/expense.controller.js";

router.post("/:id/items/:itemId/claim", claimItem);
router.delete("/:id/items/:itemId/claim", unclaimItem);
```

---

### 5. Backend Socket Event Relay

#### [MODIFY] [handlers.js](file:///d:/Coding/MERN/splitsmart/backend/socket/handlers.js)

Relay `'item-claimed'` notifications to other clients:
```javascript
    // Relay item claim/unclaim to all OTHER clients in the room
    socket.on("item-claimed", ({ groupId, expenseId }) => {
      socket.to(groupId).emit("item-claimed", { expenseId });
    });
```

---

### 6. Frontend: Interactive BillClaimCard Component

#### [MODIFY] [BillClaimCard.jsx](file:///d:/Coding/MERN/splitsmart/frontend/src/components/group/BillClaimCard.jsx)

Fully rewrite `BillClaimCard` to display multi-user claim status, allow adding claims up to the remaining quantity limit, unclaim existing claims, show clean user names under claimed items, and handle socket-based updates.

```javascript
import { useState, useEffect } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
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
  const [submitting, setSubmitting] = useState(false)
  
  // Track newly selected items in the current session (itemId -> quantity)
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

  const nonTaxItems = items.filter(i => !isTaxItem(i.name))

  // An item is fully claimed if the sum of claimed quantities matches the total quantity
  const allClaimed = nonTaxItems.length > 0 && nonTaxItems.every(i => {
    const totalClaimed = (i.claims || []).reduce((sum, c) => sum + c.quantity, 0)
    return totalClaimed === i.quantity
  })

  // Calculate my confirmed claimed items sum (using .toString() to prevent MongoDB ID type issues)
  const myClaimedTotal = nonTaxItems.reduce((sum, i) => {
    const myClaim = (i.claims || []).find(c => c.user?._id?.toString() === user?._id?.toString())
    return sum + (myClaim ? i.price * myClaim.quantity : 0)
  }, 0)

  // Calculate tax distribution for live preview (using .toString() to prevent MongoDB ID type issues)
  let totalTaxAmount = 0
  const currentParticipants = new Set()
  
  items.forEach(i => {
    if (isTaxItem(i.name)) {
      totalTaxAmount += (i.price * (i.quantity || 1))
    } else {
      (i.claims || []).forEach(c => {
        if (c.user?._id) {
          currentParticipants.add(c.user._id.toString())
        }
      })
    }
  })

  // Add current user if they have pending selections (using .toString())
  const hasPendingSelection = Object.keys(selectedItems).length > 0
  if (hasPendingSelection && user?._id) {
    currentParticipants.add(user._id.toString())
  }

  const handleToggleSelect = (item, remainingQty) => {
    if (remainingQty <= 0) return
    setSelectedItems(prev => {
      const updated = { ...prev }
      if (updated[item._id]) {
        delete updated[item._id]
      } else {
        updated[item._id] = 1 // Default to 1 on initial toggle
      }
      return updated
    })
  }

  const handleUpdateQuantity = (itemId, newQty, remainingQty) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: Math.min(remainingQty, Math.max(1, newQty))
    }))
  }

  const handleConfirm = async () => {
    const itemsToClaim = Object.entries(selectedItems)
    if (itemsToClaim.length === 0 || submitting) return

    setSubmitting(true)
    try {
      for (const [itemId, qty] of itemsToClaim) {
        // Send absolute quantity to set or increment claim
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
      toast.success("Items claimed successfully!")
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(err.response.data.message || "A claim conflict occurred. Please try again.")
        setSelectedItems({})
        await fetchExpense()
      } else {
        toast.error(err.response?.data?.message || "Failed to claim items")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnclaim = async (itemId) => {
    try {
      await api.delete(`/api/expense/${expense._id}/items/${itemId}/claim`)
      
      // Emit socket event
      if (socket) {
        socket.emit('item-claimed', { groupId: expense.group, expenseId: expense._id })
      }
      
      await fetchExpense()
      toast.success("Item unclaimed")
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to unclaim item")
    }
  }

  // Selected total using .toString() on i._id to match string key 'id'
  const selectedTotal = Object.entries(selectedItems).reduce((sum, [id, qty]) => {
    const item = items.find(i => i._id?.toString() === id)
    if (!item || isTaxItem(item.name)) return sum
    return sum + (item.price * qty)
  }, 0)

  const participantCount = currentParticipants.size
  const taxPerPerson = participantCount > 0 ? (totalTaxAmount / participantCount) : 0
  const isCurrentlyParticipating = user?._id && currentParticipants.has(user._id.toString())
  const myTaxShare = isCurrentlyParticipating ? taxPerPerson : 0

  const displayTotal = myClaimedTotal + selectedTotal + myTaxShare

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
            {allClaimed ? "Finalized" : "Open"}
          </span>
        </div>
      </div>

      {/* Item List */}
      <div className="p-2 space-y-1">
        {items.map(item => {
          const isTax = isTaxItem(item.name)
          
          // Compute claim details (using .toString() for ID comparisons)
          const claims = item.claims || []
          const otherClaims = claims.filter(c => c.user?._id?.toString() !== user?._id?.toString())
          const otherClaimsQty = otherClaims.reduce((sum, c) => sum + c.quantity, 0)
          
          const myClaim = claims.find(c => c.user?._id?.toString() === user?._id?.toString())
          const myClaimedQty = myClaim ? myClaim.quantity : 0
          
          const remainingQty = isTax ? 0 : item.quantity - otherClaimsQty - myClaimedQty
          const isSelectedByMe = !isTax && !!selectedItems[item._id]
          const selectedQty = selectedItems[item._id] || 0
          
          // Display logic
          const isFullyClaimed = !isTax && (otherClaimsQty + myClaimedQty === item.quantity)
          
          return (
            <div 
              key={item._id}
              onClick={() => {
                if (!isTax && !isFullyClaimed && remainingQty > 0) {
                  handleToggleSelect(item, remainingQty)
                }
              }}
              className={cn(
                "flex flex-col gap-1 p-2 rounded-lg transition-colors",
                !isTax && !isFullyClaimed && remainingQty > 0 ? "cursor-pointer hover:bg-[#252525]" : "",
                isSelectedByMe ? "bg-[rgba(255,255,255,0.04)]" : ""
              )}
            >
              <div className="flex items-center gap-3">
                {/* Custom Checkbox/Indicator */}
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                  isTax
                    ? "border-[#3a3a3a] opacity-50 bg-[#121212]"
                    : myClaimedQty > 0 
                      ? "border-accent-green bg-[rgba(34,197,94,0.12)]" 
                      : isSelectedByMe
                        ? "border-accent-green bg-transparent"
                        : isFullyClaimed
                          ? "border-[#3a3a3a] bg-[#121212]"
                          : "border-[#4b5563] bg-transparent"
                )}>
                  {(myClaimedQty > 0 || isSelectedByMe) && !isTax && (
                    <div className="w-2 h-2 rounded-full bg-accent-green" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {item.name}
                      </p>
                      <span className="text-xs text-[#6b7280]">×{item.quantity}</span>
                      
                      {/* Quantity selector for pending select */}
                      {isSelectedByMe && remainingQty > 1 && (
                        <div className="flex items-center bg-[#1a1a1a] rounded-md border border-white/[0.04] py-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button" 
                            onClick={() => handleUpdateQuantity(item._id, selectedQty - 1, remainingQty)}
                            className="w-5 h-4 flex items-center justify-center text-[#6b7280] hover:text-white text-xs font-bold"
                          >-</button>
                          <span className="w-4 text-center text-[11px] font-medium text-white">{selectedQty}</span>
                          <button 
                            type="button" 
                            onClick={() => handleUpdateQuantity(item._id, selectedQty + 1, remainingQty)}
                            className="w-5 h-4 flex items-center justify-center text-[#6b7280] hover:text-white text-xs font-bold"
                          >+</button>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-white shrink-0">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Claim Metadata / Names list */}
                  <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                    {isTax ? (
                      <span className="text-[11px] text-[#6b7280] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-white/[0.02]">Auto-split</span>
                    ) : (
                      <>
                        {/* List other user claims */}
                        {otherClaims.map((c, idx) => (
                          <span key={idx} className="text-[11px] text-[#9ca3af] bg-[#222222] px-2 py-0.5 rounded-full border border-white/[0.04]">
                            {formatUsername(c.user)} ×{c.quantity}
                          </span>
                        ))}
                        
                        {/* List my confirmed claim with unclaim trigger */}
                        {myClaimedQty > 0 && (
                          <span className="text-[11px] font-medium text-accent-green bg-[rgba(34,197,94,0.08)] px-2 py-0.5 rounded-full border border-accent-green/20 flex items-center gap-1.5">
                            You ×{myClaimedQty}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnclaim(item._id)
                              }}
                              className="text-gray-400 hover:text-danger p-0.5 transition-colors"
                              title="Unclaim item"
                            >
                              <Trash2 size={11} />
                            </button>
                          </span>
                        )}

                        {/* Unclaimed count indicator */}
                        {remainingQty > 0 && !isSelectedByMe && (
                          <span className="text-[11px] text-yellow-500 bg-[rgba(234,179,8,0.06)] px-2 py-0.5 rounded-full border border-yellow-500/10">
                            {remainingQty} left
                          </span>
                        )}

                        {/* Selected pending indicator */}
                        {isSelectedByMe && (
                          <span className="text-[11px] font-medium text-accent-green bg-[rgba(34,197,94,0.04)] px-2 py-0.5 rounded-full border border-accent-green/10 border-dashed animate-pulse">
                            Selecting ×{selectedQty}
                          </span>
                        )}
                        
                        {/* Fully claimed flag */}
                        {isFullyClaimed && (
                          <span className="text-[11px] text-[#4b5563] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-white/[0.01]">
                            Claimed
                          </span>
                        )}
                      </>
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
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#6b7280]">Your share (incl. tax)</span>
          <span className="text-sm font-semibold text-white">₹{displayTotal.toFixed(2)}</span>
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
                ? "bg-accent-green text-white hover:bg-accent-green-dark shadow-md"
                : "bg-[#252525] text-[#4b5563] cursor-not-allowed"
            )}
          >
            {submitting ? "Claiming..." : "Confirm Selections"}
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## Verification Plan

### Automated Tests
- Run existing dev server: `npm run dev` to verify backend and frontend compile with no lint errors.

### Manual Verification
1. Create a group. Add users Daivi and Ravi.
2. Create a new item-based split expense: "Dinner" with "Pizza x2" (₹200 each) and "GST x1" (₹40).
3. Log in as Daivi. View the bill card in the group chat.
4. Select 1 Pizza. Confirm the claim.
   - Verify: Daivi's name appears under "Pizza" with "You x1".
   - Verify: Remaining available quantity shows 1.
   - Verify: Your total updates (₹200 pizza + ₹20 tax = ₹220).
5. Log in as Ravi in another window/incognito.
   - Verify: Ravi sees Pizza x1 remaining, and Daivi x1 claimed in real time.
   - Verify: Ravi selects and claims the last Pizza x1.
   - Verify: Split totals correctly set Daivi's share to ₹220 and Ravi's share to ₹220.
6. Test Unclaiming: Daivi clicks unclaim.
   - Verify: Pizza reverts to 1 remaining for Ravi. Real-time broadcast refreshes Ravi's view.
