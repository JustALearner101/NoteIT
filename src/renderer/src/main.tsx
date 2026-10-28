import React from 'react'
import ReactDOM from 'react-dom/client'

// Font self-hosted (subset latin) — menggantikan <link> Google Fonts di index.html.
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'

import { App } from './App'
import { QuickCapture } from './components/capture/QuickCapture'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/globals.css'

// Window capture memakai entry HTML yang sama; query param memilih komponennya.
const isCaptureWindow = new URLSearchParams(window.location.search).get('window') === 'capture'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>{isCaptureWindow ? <QuickCapture /> : <App />}</ErrorBoundary>
  </React.StrictMode>
)
