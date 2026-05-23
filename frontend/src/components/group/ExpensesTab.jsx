import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { expenseService } from '../../services/expense.service'
import LoadingSpinner from '../shared/LoadingSpinner'
import { cn } from '../../lib/cn'
import { Receipt } from 'lucide-react'

import { formatUsername, getInitials } from '../../utils/format'

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function groupByDate(expenses) {
  const groups = {}
  expenses.forEach((exp) => {
    const key = formatDate(exp.createdAt)
    if (!groups[key]) groups[key] = []
    groups[key].push(exp)
  })
  return groups
}

function ExpenseRow({ expense, groupId }) {
  const navigate = useNavigate()
  const payer = expense.paidBy

  return (
    <button
      id={`expense-${expense._id}`}
      onClick={() => navigate(`/groups/${groupId}/expenses/${expense._id}`)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl',
        'bg-[#252525] hover:bg-[#2e2e2e] active:bg-[#333]',
        'transition-colors duration-150 text-left'
      )}
    >
      {/* Expense Icon */}
      <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
        {expense.icon ? (
          <span className="text-lg">{expense.icon}</span>
        ) : (
          <span className="text-sm font-medium text-[#6b7280]">
            {expense.description ? expense.description[0].toUpperCase() : '?'}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-[14px] font-medium text-white truncate">
            {expense.description}
          </h4>
          {expense.approvalStatus === 'pending' && (
            <span className="shrink-0 text-[10px] font-medium text-yellow-500 bg-[rgba(234,179,8,0.12)] px-1.5 py-0.5 rounded">
              Pending
            </span>
          )}
        </div>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          Paid by <span className="font-medium text-[#9ca3af]">{formatUsername(payer)}</span>
        </p>
      </div>

      {/* Amount */}
      <span className="text-[14px] font-medium text-white flex-shrink-0">
        ₹{expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#252525] flex items-center justify-center mb-4">
        <Receipt size={24} className="text-[#4b5563]" />
      </div>
      <h3 className="text-base font-medium text-white mb-1.5">
        No expenses yet
      </h3>
      <p className="text-sm text-[#6b7280] text-center max-w-[240px] leading-relaxed">
        Add your first expense using the + button below.
      </p>
    </div>
  )
}

export default function ExpensesTab({ groupId }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    expenseService.getGroupExpenses(groupId)
      .then((res) => {
        // API returns either an array or { expenses: [] }
        const data = Array.isArray(res.data) ? res.data : (res.data.expenses || [])
        setExpenses(data)
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load expenses'))
      .finally(() => setLoading(false))
  }, [groupId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  if (expenses.length === 0) {
    return <EmptyState />
  }

  const grouped = groupByDate(expenses)

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([date, exps]) => (
        <div key={date}>
          {/* Date label */}
          <h3 className="text-[13px] font-medium text-[#6b7280] uppercase tracking-[0.08em] mb-2">
            {date}
          </h3>
          <div className="flex flex-col gap-2">
            {exps.map((exp) => (
              <ExpenseRow key={exp._id} expense={exp} groupId={groupId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
