import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ChildrenProvider } from './hooks/ChildrenContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ChildrenProvider>
        <App />
      </ChildrenProvider>
    </BrowserRouter>
  </StrictMode>,
)
