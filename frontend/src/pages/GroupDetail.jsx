import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, MoreVertical, UserPlus, Settings, Trash2, LogOut } from 'lucide-react'
import { groupService } from '../services/group.service'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import ExpensesTab from '../components/group/ExpensesTab'
import BalancesTab from '../components/group/BalancesTab'
import ChatTab from '../components/group/ChatTab'
import ShareGroupModal from '../components/group/ShareGroupModal'
import EditGroupModal from '../components/group/EditGroupModal'
import DeleteGroupModal from '../components/group/DeleteGroupModal'
import { cn } from '../lib/cn'

const TABS = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'balances', label: 'Balances' },
  { id: 'chat', label: 'Chat' },
]

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('expenses')

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const isAdmin = group?.members?.find(m => m.user._id === user?._id)?.role === 'admin'

  const handleLeaveGroup = async () => {
    const confirmLeave = window.confirm("Are you sure you want to leave this group?")
    if (!confirmLeave) return

    try {
      const res = await groupService.leaveGroup(id)
      toast.success(res.data.message || 'Left group successfully')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave group')
    }
  }

  useEffect(() => {
    groupService.getGroupById(id)
      .then((res) => setGroup(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load group'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1010] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1010] flex flex-col items-center justify-center px-6">
        <p className="text-sm text-danger mb-2">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-[#6b7280] hover:text-white transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className={cn(
      "bg-[#0f1010] flex flex-col",
      activeTab === 'chat' ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
    )}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0f1010] px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
            <button
              id="btn-back"
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 rounded-xl bg-[#252525] flex items-center justify-center hover:bg-[#2e2e2e] transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
            {group.icon && (
              <span className="text-xl leading-none pt-0.5">{group.icon}</span>
            )}
            <h1 className="text-lg font-medium text-white truncate">
              {group.name}
            </h1>
          </div>

          {/* Actions Menu (available to all members) */}
          {group && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-9 h-9 rounded-xl bg-[#252525] flex items-center justify-center hover:bg-[#2e2e2e] transition-colors"
              >
                <MoreVertical size={18} className="text-white" />
              </button>

              {isMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsMenuOpen(false)} 
                  />
                  <div className="absolute top-11 right-0 w-48 bg-[#252525] border border-white/[0.06] rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => { setIsShareModalOpen(true); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#2e2e2e] transition-colors"
                        >
                          <UserPlus size={16} className="text-[#6b7280]" />
                          Add a member
                        </button>
                        <button
                          onClick={() => { setIsEditModalOpen(true); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#2e2e2e] transition-colors"
                        >
                          <Settings size={16} className="text-[#6b7280]" />
                          Edit group
                        </button>
                        <button
                          onClick={() => { handleLeaveGroup(); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                        >
                          <LogOut size={16} />
                          Leave group
                        </button>
                        <div className="h-px bg-white/[0.04] my-1 mx-2" />
                        <button
                          onClick={() => { setIsDeleteModalOpen(true); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 size={16} />
                          Delete group
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { handleLeaveGroup(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                      >
                        <LogOut size={16} />
                        Leave group
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 max-w-3xl mx-auto bg-[#1a1a1a] rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2 text-[13px] font-medium rounded-lg transition-colors duration-150',
                activeTab === tab.id
                  ? 'bg-[#252525] text-white'
                  : 'text-[#6b7280] hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content */}
      <main className={cn(
        "max-w-3xl mx-auto w-full",
        activeTab === 'chat' 
          ? "flex-1 min-h-0 px-0 mt-0 flex flex-col" 
          : "px-4 pb-24 mt-2"
      )}>
        {activeTab === 'expenses' && (
          <ExpensesTab groupId={id} group={group} user={user} />
        )}
        {activeTab === 'balances' && (
          <BalancesTab groupId={id} user={user} />
        )}
        {activeTab === 'chat' && (
          <ChatTab groupId={id} user={user} />
        )}
      </main>

      {/* FAB — Add Expense */}
      {activeTab !== 'chat' && (
        <button
          id="fab-add-expense"
          onClick={() => navigate(`/groups/${id}/add-expense`)}
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
            'w-14 h-14 rounded-full bg-accent-green flex items-center justify-center',
            'transition-all duration-200 active:scale-95'
          )}
          aria-label="Add expense"
        >
          <Plus size={24} className="text-white" strokeWidth={2.5} />
        </button>
      )}

      <ShareGroupModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        group={group} 
      />
      <EditGroupModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        group={group}
        onGroupUpdated={setGroup}
      />
      <DeleteGroupModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        group={group} 
      />
    </div>
  )
}
