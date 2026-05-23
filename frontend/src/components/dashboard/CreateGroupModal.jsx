import { useState } from 'react'
import Modal from '../shared/Modal'
import { groupService } from '../../services/group.service'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { cn } from '../../lib/cn'

export default function CreateGroupModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const res = await groupService.createGroup({
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim()
      })
      toast.success('Group created successfully!')
      onClose()
      navigate(`/groups/${res.data._id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a New Group">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
              Group Icon & Title
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
                placeholder="E.g., Goa Trip, Apartment Rent"
                autoFocus
                className="flex-1 w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors"
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
              placeholder="What's this group for?"
              className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className={cn(
            'w-full py-3.5 rounded-xl text-sm font-medium transition-colors',
            name.trim() && !submitting
              ? 'bg-accent-green text-white hover:bg-accent-green-dark'
              : 'bg-[#252525] text-[#4b5563] cursor-not-allowed'
          )}
        >
          {submitting ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </Modal>
  )
}
