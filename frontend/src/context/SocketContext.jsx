import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { AuthContext } from './AuthContext'

export const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)
  const { token } = useContext(AuthContext)

  useEffect(() => {
    if(!token) {
      setSocket(null)
      return
    }

    const newSocket = io(import.meta.env.VITE_API_URL || '', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
    })

    return () => {
      newSocket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const joinGroup = (groupId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-group', groupId)
    }
  }

  const sendMessage = (groupId, message) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send-message', { groupId, message })
    }
  }

  const assignItem = (groupId, itemId, userId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('assign-item', { groupId, itemId, userId })
    }
  }

  return (
    <SocketContext.Provider value={{ socket, joinGroup, sendMessage, assignItem }}>
      {children}
    </SocketContext.Provider>
  )
}
