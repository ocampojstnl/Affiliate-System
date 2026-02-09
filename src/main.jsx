import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider, ToastViewport } from './components/ui/toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
      <ToastViewport />
    </ToastProvider>
  </StrictMode>,
)
