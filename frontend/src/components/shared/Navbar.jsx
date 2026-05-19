import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants/routes'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4">
      <Link to={ROUTES.HOME} className="font-display text-xl font-bold tracking-tight text-white">
        split<span className="text-accent">smart</span>
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-white/40 hidden sm:block">{user.username}</span>
            <button onClick={logout} className="text-white/50 hover:text-white transition-colors">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to={ROUTES.LOGIN} className="text-white/50 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="px-4 py-1.5 rounded-lg bg-white/[0.07] border border-white/[0.10] hover:bg-white/[0.12] transition-all"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
