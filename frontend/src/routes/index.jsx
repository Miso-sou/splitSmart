import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { ROUTES } from '../constants/routes'

const Landing = lazy(() => import('../pages/Landing'))
const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const GroupDetail = lazy(() => import('../pages/GroupDetail'))
const ExpenseDetail = lazy(() => import('../pages/ExpenseDetail'))
const AddExpense = lazy(() => import('../pages/AddExpense'))
const EditExpense = lazy(() => import('../pages/EditExpense'))
const Settlement = lazy(() => import('../pages/Settlement'))

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1010]">
      <LoadingSpinner size="lg" />
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path={ROUTES.HOME} element={<Landing />} />
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route path={ROUTES.REGISTER} element={<Register />} />
        <Route
          path={ROUTES.DASHBOARD}
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route
          path={ROUTES.GROUP}
          element={<ProtectedRoute><GroupDetail /></ProtectedRoute>}
        />
        <Route
          path={ROUTES.EXPENSE_DETAIL}
          element={<ProtectedRoute><ExpenseDetail /></ProtectedRoute>}
        />
        <Route
          path={ROUTES.ADD_EXPENSE}
          element={<ProtectedRoute><AddExpense /></ProtectedRoute>}
        />
        <Route
          path={ROUTES.EDIT_EXPENSE}
          element={<ProtectedRoute><EditExpense /></ProtectedRoute>}
        />
        <Route
          path={ROUTES.SETTLEMENT}
          element={<ProtectedRoute><Settlement /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </Suspense>
  )
}

