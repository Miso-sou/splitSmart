import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../constants/routes'
import AuthLayout from '../layouts/AuthLayout'
import GlassCard from '../components/shared/GlassCard'
import GlassInput from '../components/shared/GlassInput'
import GlassButton from '../components/shared/GlassButton'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')
      await register(username, email, password)
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register')
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <GlassCard className="max-w-sm w-full p-8 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center mb-6">
          <UserPlus className="text-accent" size={20} />
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-2 text-center">
          Create account
        </h1>
        <p className="text-white/50 text-sm mb-8 text-center">
          Join SplitSmart today
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <GlassInput
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
            minLength={3}
          />
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
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            minLength={8}
          />
          
          {error && <p className="text-danger text-xs text-center pt-1">{error}</p>}
          
          <div className="pt-2">
            <GlassButton type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </GlassButton>
          </div>
          <p className="text-white/30 text-xs text-center mt-2">
            Registration optional — join any group as a guest first
          </p>
        </form>

        <p className="text-white/40 text-sm mt-8 text-center">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-white hover:text-accent transition-colors">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </AuthLayout>
  )
}
