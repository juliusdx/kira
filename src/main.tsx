import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { App } from './app/App'
import { KiraProvider } from './app/KiraContext'

// Auto-update the offline app shell in the background.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KiraProvider>
      <App />
    </KiraProvider>
  </StrictMode>,
)
