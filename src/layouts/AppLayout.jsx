import { useState } from 'react'
import { Menu, ShieldCheck, Syringe, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { navigationItems } from '../data/navigation.js'

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell">
    <aside className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
      <NavLink className="brand" to="/" aria-label="VaxReach home" onClick={() => setMenuOpen(false)}><span className="brand-mark"><Syringe size={21} strokeWidth={2.2} /></span><span>Vax<span className="brand-accent">Reach</span><small>Immunisation outreach</small></span></NavLink>
      <p className="nav-label">WORKSPACE</p>
      <nav className="primary-nav" aria-label="Main navigation">{navigationItems.map(({ label, path, Icon }) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} onClick={() => setMenuOpen(false)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-note"><ShieldCheck size={17} /><span>Supporting healthier communities</span></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="icon-button menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="topbar-context"><span className="context-dot" /> District immunisation programme</div><div className="workspace-label"><ShieldCheck size={16} /><span>Prototype workspace</span></div></header>
      <main className="page-content"><Outlet /></main><footer className="app-footer">VaxReach <span>·</span> Community immunisation workspace</footer>
    </div>
  </div>
}

export default AppLayout
