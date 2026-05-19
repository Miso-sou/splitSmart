import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../constants/routes'
import GlassCard from '../components/shared/GlassCard'
import GlassButton from '../components/shared/GlassButton'
import GlassInput from '../components/shared/GlassInput'

export default function Landing() {
  const navigate = useNavigate()
  const { loginAsGuest, user } = useAuth()
  const [showGuestInput, setShowGuestInput] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If user is already logged in, they shouldn't see landing page
  if (user) {
    navigate(ROUTES.DASHBOARD, { replace: true })
    return null
  }

  const handleGuestSubmit = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) return
    try {
      setLoading(true)
      setError('')
      await loginAsGuest(displayName)
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join as guest')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 relative">
      <Link to={ROUTES.LOGIN} className="absolute top-6 right-6 text-sm text-white/50 hover:text-white transition-colors">
        Sign in
      </Link>

      <GlassCard className="max-w-sm w-full p-8 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center mb-6">
          <Users className="text-accent" size={24} />
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-2 text-center">
          Split smarter, settle faster.
        </h1>
        <p className="text-white/50 text-sm mb-8 text-center">
          No account needed to get started.
        </p>

        <div className="w-full space-y-3">
          <GlassButton variant="ghost" onClick={() => navigate(ROUTES.LOGIN)}>
            Sign in
          </GlassButton>
          <GlassButton variant="ghost" onClick={() => navigate(ROUTES.REGISTER)}>
            Create account
          </GlassButton>
          
          <div className="pt-2">
            {!showGuestInput ? (
              <GlassButton onClick={() => setShowGuestInput(true)}>
                Continue as guest &rarr;
              </GlassButton>
            ) : (
              <form onSubmit={handleGuestSubmit} className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <GlassInput
                  autoFocus
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loading}
                />
                {error && <p className="text-danger text-xs text-center">{error}</p>}
                <GlassButton type="submit" disabled={loading || !displayName.trim()}>
                  {loading ? 'Joining...' : 'Confirm'}
                </GlassButton>
              </form>
            )}
          </div>
        </div>
      </GlassCard>
    </main>
  )
}
