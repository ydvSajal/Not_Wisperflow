import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import '../styles.css'
import { App } from './App'
import { ToastProvider } from '@/components/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
)
