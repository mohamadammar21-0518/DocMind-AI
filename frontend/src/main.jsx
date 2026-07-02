import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const hasClerkKey = /^pk_(test|live)_[A-Za-z0-9._-]+$/.test(clerkPublishableKey || '')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {hasClerkKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    ) : (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '2rem', textAlign: 'center' }}>
        <div className="surface-card" style={{ maxWidth: 560, padding: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Clerk key missing or invalid</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Add a valid <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> to <code>.env.local</code> in the frontend folder, then restart the dev server.
          </p>
        </div>
      </div>
    )}
  </React.StrictMode>,
)
