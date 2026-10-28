import React from 'react'
import ReactDOM from 'react-dom/client'
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
