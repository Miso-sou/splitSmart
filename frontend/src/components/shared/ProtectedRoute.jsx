import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'
import { ROUTES } from '../../constants/routes'

// allowGuest: false blocks guest users from this route
export default function ProtectedRoute({ children, allowGuest = true }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to={ROUTES.LOGIN} replace />
  if (!allowGuest && user.isGuest) return <Navigate to={ROUTES.LOGIN} replace />

  return children
}
