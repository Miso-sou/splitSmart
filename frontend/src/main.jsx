import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import WakeupGate from './components/WakeupGate'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WakeupGate>
      <App />
    </WakeupGate>
  </React.StrictMode>,
)
