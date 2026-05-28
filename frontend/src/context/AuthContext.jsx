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
    localStorage.setItem('splitsmart_token', res.data.accessToken)
    setUser(res.data)
  }

  const register = async (username, email, password) => {
    const res = await authService.register(username, email, password)
    localStorage.setItem('splitsmart_token', res.data.accessToken)
    setUser(res.data)
  }

  const loginAsGuest = async (displayName) => {
    const guestId = localStorage.getItem('splitsmart_guest_id')
    const res = await authService.loginAsGuest(displayName, guestId)
    localStorage.setItem('splitsmart_token', res.data.accessToken)
    setUser(res.data)
    localStorage.setItem('splitsmart_guest_id', res.data._id)
  }

  const logout = async () => {
    await authService.logout()
    localStorage.removeItem('splitsmart_token')
    setUser(null)
  }

  const upgrade = async (username, email, password) => {
    const res = await authService.upgradeGuest(username, email, password)
    if (res.data.accessToken) {
      localStorage.setItem('splitsmart_token', res.data.accessToken)
    }
    setUser(res.data)
  }

  const updateUser = (updatedData) => {
    setUser(prev => prev ? { ...prev, ...updatedData } : null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginAsGuest, logout, upgrade, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
