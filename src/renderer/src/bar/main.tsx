import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import '../styles.css'
import { BarApp } from './BarApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BarApp />
  </StrictMode>
)
