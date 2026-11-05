import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './theme.css'
import App from './App.jsx'
import { ChildrenProvider } from './hooks/ChildrenContext.jsx'
import { OutreachProvider } from './hooks/OutreachContext.jsx'
import { AuthProvider } from './hooks/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter><AuthProvider><ChildrenProvider><OutreachProvider><App /></OutreachProvider></ChildrenProvider></AuthProvider></BrowserRouter>
  </StrictMode>,
)
