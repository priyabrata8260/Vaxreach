function PagePlaceholder({ title, description }) {
  return <section className="page-section" aria-labelledby="page-title"><div className="page-heading"><div><p className="eyebrow">VAXREACH WORKSPACE</p><h1 id="page-title">{title}</h1><p className="page-description">{description}</p></div></div><div className="placeholder-card"><div className="placeholder-icon" aria-hidden="true">VR</div><h2>{title}</h2><p>This workspace is ready for the next phase. No records or actions are available here yet.</p></div></section>
}

export default PagePlaceholder
