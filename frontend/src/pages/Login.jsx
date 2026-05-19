import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../constants/routes'
import AuthLayout from '../layouts/AuthLayout'
import GlassCard from '../components/shared/GlassCard'
import GlassInput from '../components/shared/GlassInput'
import GlassButton from '../components/shared/GlassButton'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')
      await login(email, password)
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login')
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <GlassCard className="max-w-sm w-full p-8 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center mb-6">
          <LogIn className="text-accent" size={20} />
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-2 text-center">
          Welcome back
        </h1>
        <p className="text-white/50 text-sm mb-8 text-center">
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <GlassInput
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          <GlassInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          
          {error && <p className="text-danger text-xs text-center pt-1">{error}</p>}
          
          <div className="pt-2">
            <GlassButton type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </GlassButton>
          </div>
        </form>

        <div className="w-full flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/[0.10]"></div>
          <span className="text-white/40 text-xs uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/[0.10]"></div>
        </div>

        <GlassButton variant="ghost" onClick={() => navigate(ROUTES.HOME)}>
          Continue as guest
        </GlassButton>

        <p className="text-white/40 text-sm mt-8 text-center">
          Don't have an account?{' '}
          <Link to={ROUTES.REGISTER} className="text-white hover:text-accent transition-colors">
            Register
          </Link>
        </p>
      </GlassCard>
    </AuthLayout>
  )
}
