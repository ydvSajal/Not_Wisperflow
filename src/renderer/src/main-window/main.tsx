import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import '../styles.css'
import { App } from './App'
import { ToastProvider } from '@/components/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="fixed inset-x-0 top-0 z-50 h-8 [-webkit-app-region:drag]" />
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
)
