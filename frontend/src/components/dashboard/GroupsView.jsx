import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import { groupService } from '../../services/group.service'
import LoadingSpinner from '../shared/LoadingSpinner'
import { cn } from '../../lib/cn'

function getInitials(name) {
  return name
    .split(/[\s]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function GroupCard({ group, onClick }) {
  return (
    <button
      id={`group-${group._id}`}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 px-5 py-4 rounded-2xl',
        'bg-[#252525]',
        'hover:bg-[#2e2e2e] active:bg-[#333]',
        'transition-colors duration-150',
        'text-left group'
      )}
    >
      {/* Initials avatar */}
      <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
        {group.icon ? (
          <span className="text-lg">{group.icon}</span>
        ) : (
          <span className="text-xs font-medium text-[#6b7280]">
            {getInitials(group.name)}
          </span>
        )}
      </div>

      {/* Group info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-medium text-white truncate">
          {group.name}
        </h3>
        {group.description ? (
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">
            {group.description}
          </p>
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Users size={11} className="text-[#4b5563]" />
            <span className="text-[12px] text-[#4b5563]">
              {group.members?.length || 0} members
            </span>
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight
        size={16}
        className="text-[#4b5563] group-hover:text-[#6b7280] transition-colors flex-shrink-0"
      />
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#252525] flex items-center justify-center mb-4">
        <Users size={24} className="text-[#4b5563]" />
      </div>
      <h3 className="text-base font-medium text-white mb-1.5">
        No expense groups yet
      </h3>
      <p className="text-sm text-[#6b7280] text-center max-w-[260px] leading-relaxed">
        Create a new group or join an existing one using the + button below.
      </p>
    </div>
  )
}

export default function GroupsView() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    groupService.getGroups()
      .then((res) => setGroups(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load groups'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <p className="text-sm text-danger mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-[#6b7280] hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <section id="groups-view">
      {/* Section label */}
      <h2 className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] mb-3">
        Groups
      </h2>

      {/* Group list */}
      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <GroupCard
              key={group._id}
              group={group}
              onClick={() => navigate(`/groups/${group._id}`)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
