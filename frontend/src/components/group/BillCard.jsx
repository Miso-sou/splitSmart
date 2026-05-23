import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'

export default function BillCard({ items, groupId, claims, onClaim }) {
  const { user } = useAuth()
  const { assignItem } = useSocket()

  const handleClaim = (itemId) => {
    assignItem(groupId, itemId, user._id)
    // Optimistic update
    if (onClaim) onClaim(itemId, user._id, user.username)
  }

  if (!items || items.length === 0) return null

  return (
    <div className="bg-surface border border-surface-border rounded-lg p-3 max-w-[300px]">
      <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wide">
        Bill Items
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const claim = claims?.[item.id]
          const isClaimed = !!claim
          const isOwnClaim = claim?.userId === user._id

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.name}</p>
                <p className="text-xs text-muted">
                  ₹{Number(item.amount).toFixed(2)}
                </p>
              </div>
              {isClaimed ? (
                <span className={cn(
                  'text-xs px-2 py-1 rounded-md shrink-0',
                  isOwnClaim
                    ? 'bg-[rgba(34,197,94,0.12)] text-accent-green'
                    : 'bg-[#2e2e2e] text-muted'
                )}>
                  {claim.username || 'Claimed'}
                </span>
              ) : (
                <button
                  onClick={() => handleClaim(item.id)}
                  className="text-xs px-2 py-1 rounded-md bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition-colors shrink-0"
                >
                  Claim
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
