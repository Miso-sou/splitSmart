import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import AppRoutes from './routes'
import { Toaster } from 'react-hot-toast'

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'rgba(20,20,28,0.92)',
                color: '#f5f5f5',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
                borderRadius: '12px',
                fontSize: '14px',
              },
            }}
          />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  )
}
