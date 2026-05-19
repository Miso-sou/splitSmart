import { createContext, useState, useEffect } from 'react'
import { authService } from '../services/auth.service'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService.getMe()
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await authService.login(email, password)
    setUser(res.data)
  }

  const register = async (username, email, password) => {
    const res = await authService.register(username, email, password)
    setUser(res.data)
  }

  const loginAsGuest = async (displayName) => {
    const res = await authService.loginAsGuest(displayName)
    setUser(res.data)
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
