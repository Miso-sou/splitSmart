import { useState } from 'react'
import Modal from '../shared/Modal'
import { groupService } from '../../services/group.service'
import { cn } from '../../lib/cn'
import { X, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

import { formatUsername, getInitials } from '../../utils/format'

export default function EditGroupModal({ isOpen, onClose, group, onGroupUpdated }) {
  const { user: currentUser } = useAuth()
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [icon, setIcon] = useState(group?.icon || '')
  const [submitting, setSubmitting] = useState(false)

  // Optimistic UI for member removal
  const [members, setMembers] = useState(group?.members || [])

  const handleUpdateDetails = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const res = await groupService.updateGroup(group._id, {
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim()
      })
      toast.success('Group updated')
      onGroupUpdated(res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update group')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveMember = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from the group?`)) return

    try {
      await groupService.removeMember(group._id, userId)
      toast.success('Member removed')
      setMembers(prev => prev.filter(m => m.user._id !== userId))
      // Inform parent that members changed (parent might need to reload)
      onGroupUpdated({ ...group, members: members.filter(m => m.user._id !== userId) })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Group">
      <form onSubmit={handleUpdateDetails} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
              Group Icon & Name
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🏖️"
                maxLength={2}
                className="w-12 h-12 flex-shrink-0 text-center rounded-xl text-lg text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] focus:outline-none focus:border-[#6b7280] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
              Description <span className="normal-case tracking-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] focus:outline-none focus:border-[#6b7280] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-medium transition-colors',
              name.trim() && !submitting
                ? 'bg-white text-black hover:bg-gray-200'
                : 'bg-[#252525] text-[#4b5563] cursor-not-allowed'
            )}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="h-px bg-white/[0.04]" />

        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-3">
            Manage Members
          </label>
          <div className="bg-[#252525] rounded-2xl overflow-hidden">
            {members.map((m, i) => {
              const uid = m.user._id
              const isMe = uid === currentUser?._id
              return (
                <div
                  key={uid}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    i < members.length - 1 && 'border-b border-white/[0.04]'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-medium text-[#6b7280]">
                      {getInitials(formatUsername(m.user))}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white truncate">
                      {formatUsername(m.user)}
                      {isMe && <span className="text-[#6b7280] ml-1">(me)</span>}
                    </p>
                    {m.role === 'admin' && (
                      <p className="text-[11px] text-accent-green">Admin</p>
                    )}
                  </div>
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(uid, formatUsername(m.user))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                      title="Remove member"
                    >
                      <UserX size={16} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}
