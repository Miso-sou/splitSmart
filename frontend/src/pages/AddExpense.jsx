import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronUp, ChevronDown, Camera, Loader2, Trash2 } from 'lucide-react'
import { groupService } from '../services/group.service'
import { expenseService } from '../services/expense.service'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { cn } from '../lib/cn'
import toast from 'react-hot-toast'
import api from '../api/axios'

import { formatUsername, getInitials } from '../utils/format'

const CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
]

export default function AddExpense() {
  const { id: groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [group, setGroup] = useState(null)
  const [loadingGroup, setLoadingGroup] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isParsingBill, setIsParsingBill] = useState(false)

  const fileInputRef = useRef(null)

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
  const [items, setItems] = useState([])

  // Load group data
  useEffect(() => {
    groupService.getGroupById(groupId)
      .then((res) => {
        setGroup(res.data)
        // Default paidBy to current user
        setPaidBy(user?._id || '')
        // Select all members by default
        const sel = {}
        res.data.members.forEach((m) => {
          sel[m.user._id] = true
        })
        setSelectedMembers(sel)
      })
      .catch(() => toast.error('Failed to load group'))
      .finally(() => setLoadingGroup(false))
  }, [groupId, user])

  const members = group?.members || []
  const parsedAmount = parseFloat(amount) || 0

  // Item-based calculations
  const itemsTotal = items.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)), 0)

  // Validation
  const selectedCount = Object.values(selectedMembers).filter(Boolean).length
  const customTotal = Object.entries(customAmounts)
    .filter(([uid]) => selectedMembers[uid])
    .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0)
  const customDiff = parsedAmount - customTotal

  const isItemsValid = items.length > 0 && items.every(i => i.name.trim() && parseFloat(i.price) > 0)
  
  const isValid =
    title.trim() &&
    parsedAmount > 0 &&
    paidBy &&
    (
      (splitType === 'equal' && selectedCount > 0) ||
      (splitType === 'custom' && selectedCount > 0 && Math.abs(customDiff) < 0.02) ||
      (splitType === 'item-based' && isItemsValid)
    )

  const handleToggleMember = (uid) => {
    setSelectedMembers((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }

  const handleCustomAmount = (uid, val) => {
    setCustomAmounts((prev) => ({ ...prev, [uid]: val }))
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''
    setIsParsingBill(true)
    setSplitType('item-based')

    try {
      const formData = new FormData()
      formData.append('billImage', file)

      const res = await api.post('/api/bills/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (res.data.items && res.data.items.length > 0) {
        setItems(res.data.items.map(i => ({ 
          id: i.id || Date.now() + Math.random(), 
          name: i.name, 
          price: i.amount || i.price, 
          quantity: i.quantity || 1 
        })))
      }
      
      if (res.data.total) {
        setAmount(res.data.total.toString())
      }
    } catch (err) {
      toast.error(
        <div className="flex flex-col">
          <span>Couldn't read bill. Add items manually.</span>
          <button onClick={() => toast.dismiss()} className="text-xs text-left text-[#6b7280] hover:text-white mt-1">Dismiss</button>
        </div>,
        { duration: 5000 }
      )
    } finally {
      setIsParsingBill(false)
    }
  }

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), name: '', price: '', quantity: 1 }])
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
        splitType,
        totalAmount: splitType === 'item-based' ? itemsTotal : parsedAmount,
        items: splitType === 'item-based' 
          ? items.map(i => ({ name: i.name.trim(), price: parseFloat(i.price) || 0, quantity: parseInt(i.quantity) || 1, assignedTo: null }))
          : [{ name: title.trim(), price: parsedAmount, quantity: 1 }]
      }

      if (splitType === 'equal') {
        payload.splitAmong = selectedIds
      } else if (splitType === 'custom') {
        payload.customSplits = selectedIds.map((uid) => ({
          user: uid,
          amount: parseFloat(customAmounts[uid]) || 0,
        }))
      }

      const res = await expenseService.createExpense(payload)
      const newExpenseId = res.data._id

      if (splitType === 'item-based') {
        // Broadcast via message route
        await api.post(`/api/group/${groupId}/messages`, {
          text: `📋 Bill split: ${title.trim()} — ₹${itemsTotal.toFixed(2)}`,
          expenseId: newExpenseId
        })
      }

      toast.success('Expense added')
      navigate(`/groups/${groupId}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense')
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
            Add Expense
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
            <div className="flex-1 relative flex items-center bg-[#252525] border border-white/[0.06] rounded-xl focus-within:border-[#6b7280] transition-colors">
              <input
                id="input-title"
                type="text"
                placeholder="E.g. Dinner, Taxi, Groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 w-full px-4 py-3 bg-transparent text-sm text-white placeholder:text-[#4b5563] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingBill}
                className="w-10 h-10 mr-1 flex items-center justify-center text-[#6b7280] hover:text-white transition-colors shrink-0 disabled:opacity-50"
              >
                <Camera size={18} />
              </button>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
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
            {['equal', 'custom', 'item-based'].map((type) => (
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

        {/* Dynamic Split UI */}
        {splitType === 'item-based' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em]">
                Items
              </label>
              {isParsingBill && (
                <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
                  <Loader2 size={12} className="animate-spin" />
                  Reading your bill...
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="bg-[#252525] border border-white/[0.04] rounded-xl p-3 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-[120px]">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                      className="w-full bg-transparent text-sm text-white placeholder:text-[#4b5563] focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#1a1a1a] rounded-lg border border-white/[0.04]">
                      <button 
                        type="button" 
                        onClick={() => handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(item.quantity) - 1))}
                        className="w-7 h-7 flex items-center justify-center text-[#6b7280] hover:text-white"
                      >-</button>
                      <span className="w-6 text-center text-xs text-white">{item.quantity}</span>
                      <button 
                        type="button" 
                        onClick={() => handleUpdateItem(idx, 'quantity', parseInt(item.quantity) + 1)}
                        className="w-7 h-7 flex items-center justify-center text-[#6b7280] hover:text-white"
                      >+</button>
                    </div>

                    <div className="w-20 relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                        className="w-full pl-5 pr-2 py-1.5 bg-[#1a1a1a] rounded-lg border border-white/[0.04] text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div className="w-16 text-right">
                      <span className="text-xs text-[#6b7280]">
                        ₹{((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="w-8 h-8 flex items-center justify-center text-[#4b5563] hover:text-danger transition-colors ml-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm font-medium text-accent-green hover:text-white transition-colors px-2 py-1"
              >
                + Add item
              </button>

              <div className="text-right">
                <span className="text-sm text-[#6b7280]">Total: ₹{itemsTotal.toFixed(2)}</span>
              </div>
            </div>

            {parsedAmount > 0 && Math.abs(parsedAmount - itemsTotal) > 0.02 && (
              <p className="text-[12px] text-danger mt-2 text-right">
                Mismatch with total amount (₹{parsedAmount.toFixed(2)})
              </p>
            )}
          </div>
        ) : (
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
        )}

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
          {submitting ? 'Adding...' : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}
