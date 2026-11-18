import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { ScreenErrorBoundary } from './App.tsx'

// A preview can outlive the Vite module graph after an update. When a lazy
// screen then requests an old chunk, the preview host may answer with index.html
// and the browser reports a JavaScript MIME type error. Refresh at most once
// every 30 seconds; the old permanent session flag stopped recovery for the
// remainder of a tab after its first successful reload.
const stalePreviewReloadKey = 'afl-manager-stale-preview-reloaded-at'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(stalePreviewReloadKey) ?? 0)
    if (Date.now() - lastReloadAt < 30_000) return
    window.sessionStorage.setItem(stalePreviewReloadKey, String(Date.now()))
  } catch {
    // Leave the original import error visible if reload-loop protection is unavailable.
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScreenErrorBoundary>
      <App />
    </ScreenErrorBoundary>
  </StrictMode>,
)
