import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { groupService } from '../services/group.service'
import { expenseService } from '../services/expense.service'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { cn } from '../lib/cn'
import toast from 'react-hot-toast'

import { formatUsername, getInitials } from '../utils/format'

const CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
]

export default function EditExpense() {
  const { id: groupId, expenseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [group, setGroup] = useState(null)
  const [loadingGroup, setLoadingGroup] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('other')
  const [splitType, setSplitType] = useState('equal')

  // Split state
  const [selectedMembers, setSelectedMembers] = useState({})
  const [customAmounts, setCustomAmounts] = useState({})

  // Load group and expense data
  useEffect(() => {
    Promise.all([
      groupService.getGroupById(groupId),
      expenseService.getGroupExpenses(groupId)
    ])
      .then(([groupRes, expensesRes]) => {
        setGroup(groupRes.data)
        const expensesData = Array.isArray(expensesRes.data) ? expensesRes.data : (expensesRes.data.expenses || [])
        const expense = expensesData.find((e) => e._id === expenseId)
        
        if (expense) {
          setTitle(expense.description || '')
          setIcon(expense.icon || '')
          setAmount(expense.totalAmount?.toString() || '')
          setPaidBy(expense.paidBy?._id || expense.paidBy || user?._id || '')
          if (expense.createdAt) setDate(new Date(expense.createdAt).toISOString().split('T')[0])
          setCategory(expense.category || 'other')
          
          // Determine split type
          let type = 'equal'
          if (expense.items && expense.items.length > 1) {
             type = 'item-based'
          } else if (expense.splits && expense.splits.length > 0) {
            const amounts = expense.splits.map((s) => s.amount)
            const allEqual = amounts.every((a) => Math.abs(a - amounts[0]) < 0.02)
            type = allEqual ? 'equal' : 'custom'
          }
          setSplitType(type)

          const sel = {}
          const cAmounts = {}
          expense.splits.forEach(s => {
             const uid = s.user?._id || s.user
             sel[uid] = true
             cAmounts[uid] = s.amount?.toString() || ''
          })
          setSelectedMembers(sel)
          setCustomAmounts(cAmounts)
        } else {
          toast.error('Expense not found')
          navigate(`/groups/${groupId}`)
        }
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoadingGroup(false))
  }, [groupId, expenseId, user, navigate])

  const members = group?.members || []
  const parsedAmount = parseFloat(amount) || 0

  // Validation
  const selectedCount = Object.values(selectedMembers).filter(Boolean).length
  const customTotal = Object.entries(customAmounts)
    .filter(([uid]) => selectedMembers[uid])
    .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0)
  const customDiff = parsedAmount - customTotal

  const isValid =
    title.trim() &&
    parsedAmount > 0 &&
    paidBy &&
    selectedCount > 0 &&
    (splitType === 'equal' || (splitType === 'custom' && Math.abs(customDiff) < 0.02))

  const handleToggleMember = (uid) => {
    setSelectedMembers((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }

  const handleCustomAmount = (uid, val) => {
    setCustomAmounts((prev) => ({ ...prev, [uid]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || submitting) return

    setSubmitting(true)

    try {
      const selectedIds = Object.entries(selectedMembers)
        .filter(([, v]) => v)
        .map(([uid]) => uid)

      const payload = {
        group: groupId,
        description: title.trim(),
        icon: icon.trim(),
        paidBy,
        category,
        items: [{ name: title.trim(), price: parsedAmount, quantity: 1 }],
        splitType,
      }

      if (splitType === 'equal') {
        payload.splitAmong = selectedIds
      } else if (splitType === 'custom') {
        payload.customSplits = selectedIds.map((uid) => ({
          user: uid,
          amount: parseFloat(customAmounts[uid]) || 0,
        }))
      }

      await expenseService.updateExpense(expenseId, payload)
      toast.success('Expense updated')
      navigate(`/groups/${groupId}/expenses/${expenseId}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update expense')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingGroup) {
    return (
      <div className="min-h-screen bg-[#0f1010] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1010]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0f1010] px-4 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button
            id="btn-back"
            onClick={() => navigate(`/groups/${groupId}`)}
            className="w-9 h-9 rounded-xl bg-[#252525] flex items-center justify-center hover:bg-[#2e2e2e] transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="text-lg font-medium text-white">
            Edit Expense
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-5 max-w-3xl mx-auto space-y-5">
        {/* Title and Icon */}
        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
            Icon & Title
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🍔"
              maxLength={2}
              className="w-12 h-12 flex-shrink-0 text-center rounded-xl text-lg text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors"
            />
            <input
              id="input-title"
              type="text"
              placeholder="E.g. Dinner, Taxi, Groceries"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors"
            />
          </div>
        </div>

        {/* Description (optional) */}
        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
            Description
            <span className="text-[#4b5563] normal-case tracking-normal ml-1.5">optional</span>
          </label>
          <input
            id="input-description"
            type="text"
            placeholder="Add a note"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">₹</span>
            <input
              id="input-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-10 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setAmount(prev => Math.max(0, (parseFloat(prev) || 0) + 1).toFixed(2))}
                className="text-accent-green hover:text-white transition-colors"
              >
                <ChevronUp size={16} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => setAmount(prev => Math.max(0, (parseFloat(prev) || 0) - 1).toFixed(2))}
                className="text-accent-green hover:text-white transition-colors mt-[2px]"
              >
                <ChevronDown size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          {/* Quick add buttons */}
          <div className="flex gap-2 mt-3">
            {[100, 500, 1000, 2000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(prev => ((parseFloat(prev) || 0) + val).toFixed(2))}
                className="flex-1 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/[0.04] text-[12px] text-[#6b7280] hover:text-white hover:bg-[#252525] transition-colors"
              >
                +₹{val}
              </button>
            ))}
          </div>
        </div>

        {/* Paid by + Date row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
              Paid by
            </label>
            <select
              id="select-paid-by"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] focus:outline-none focus:border-[#6b7280] transition-colors appearance-none"
            >
              {members.map((m) => (
                <option key={m.user._id} value={m.user._id}>
                  {formatUsername(m.user)}{m.user._id === user?._id ? ' (me)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
              Date
            </label>
            <input
              id="input-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] focus:outline-none focus:border-[#6b7280] transition-colors"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
            Category
          </label>
          <select
            id="select-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#252525] border border-white/[0.06] focus:outline-none focus:border-[#6b7280] transition-colors appearance-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Split type */}
        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
            Split
          </label>
          <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1">
            {['equal', 'custom'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSplitType(type)}
                className={cn(
                  'flex-1 py-2 text-[13px] font-medium rounded-lg transition-colors duration-150 capitalize',
                  splitType === type
                    ? 'bg-[#252525] text-white'
                    : 'text-[#6b7280] hover:text-white'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Member checklist */}
        <div>
          <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] block mb-2">
            Split among
          </label>
          <div className="bg-[#252525] rounded-2xl overflow-hidden">
            {members.map((m, i) => {
              const uid = m.user._id
              const checked = !!selectedMembers[uid]
              return (
                <div
                  key={uid}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    i < members.length - 1 && 'border-b border-white/[0.04]'
                  )}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleMember(uid)}
                    className={cn(
                      'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                      checked
                        ? 'bg-accent-green border-accent-green'
                        : 'border-[#4b5563] bg-transparent'
                    )}
                  >
                    {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>

                  {/* Avatar + name */}
                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-medium text-[#6b7280]">
                      {getInitials(formatUsername(m.user))}
                    </span>
                  </div>
                  <p className={cn(
                    'text-[14px] font-medium flex-1 truncate',
                    checked ? 'text-white' : 'text-[#4b5563]'
                  )}>
                    {formatUsername(m.user)}
                    {m.user._id === user?._id ? ' (me)' : ''}
                  </p>

                  {/* Custom amount input */}
                  {splitType === 'custom' && checked && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={customAmounts[uid] || ''}
                      onChange={(e) => handleCustomAmount(uid, e.target.value)}
                      className="w-24 px-3 py-1.5 rounded-lg text-sm text-white bg-[#1a1a1a] border border-white/[0.06] placeholder:text-[#4b5563] focus:outline-none focus:border-[#6b7280] text-right"
                    />
                  )}

                  {/* Equal amount display */}
                  {splitType === 'equal' && checked && parsedAmount > 0 && (
                    <span className="text-[13px] text-[#6b7280] flex-shrink-0">
                      ₹{(parsedAmount / selectedCount).toFixed(2)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Custom split validation */}
          {splitType === 'custom' && parsedAmount > 0 && (
            <p className={cn(
              'text-[12px] mt-2 text-right',
              Math.abs(customDiff) < 0.02 ? 'text-accent-green' : 'text-danger'
            )}>
              {Math.abs(customDiff) < 0.02
                ? '✓ Splits match total'
                : customDiff > 0
                  ? `₹${customDiff.toFixed(2)} remaining`
                  : `₹${Math.abs(customDiff).toFixed(2)} over`
              }
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          id="btn-submit-expense"
          type="submit"
          disabled={!isValid || submitting}
          className={cn(
            'w-full py-3.5 rounded-xl text-sm font-medium transition-colors',
            isValid && !submitting
              ? 'bg-accent-green text-white hover:bg-accent-green-dark active:scale-[0.98]'
              : 'bg-[#252525] text-[#4b5563] cursor-not-allowed'
          )}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
