import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)

const buttonVariants = {
  primary: 'primary-action',
  secondary: 'secondary-action',
  danger: 'vr-button--danger',
  subtle: 'vr-button--subtle',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return <button className={`vr-button ${buttonVariants[variant] ?? buttonVariants.primary} ${className}`.trim()} type={type} {...props} />
}

export function Field({ label, htmlFor, hint, error, required = false, className = '', children }) {
  const describedBy = [hint && `${htmlFor}-hint`, error && `${htmlFor}-error`].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children) && describedBy
    ? cloneElement(children, {
      'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' '),
      'aria-invalid': error ? true : children.props['aria-invalid'],
    })
    : children
  return <div className={`vr-field ${className}`.trim()}>
    <label htmlFor={htmlFor}>{label}{required && <span className="vr-field-required">Required</span>}</label>
    {control}
    {hint && <small id={`${htmlFor}-hint`} className="vr-field-hint">{hint}</small>}
    {error && <small id={`${htmlFor}-error`} className="vr-field-error" role="alert">{error}</small>}
  </div>
}

export function Modal({ open, onClose, title, description, children, footer, size = 'medium' }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return <dialog
    ref={dialogRef}
    className={`vr-modal vr-modal--${size}`}
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => { event.preventDefault(); onClose?.() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose?.() }}
  >
    <header className="vr-modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><Button variant="subtle" className="vr-modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></Button></header>
    <div className="vr-modal-body">{children}</div>
    {footer && <footer className="vr-modal-footer">{footer}</footer>}
  </dialog>
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', busy = false }) {
  return <Modal
    open={open}
    onClose={onClose}
    title={title}
    description={description}
    size="small"
    footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</Button></>}
  />
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(({ title, message, variant = 'success', duration = 5000 }) => {
    const id = ++nextId.current
    setToasts((current) => [...current, { id, title, message, variant }])
    if (duration > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
    return id
  }, [dismiss])

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
  }, [])

  return <ToastContext.Provider value={toast}>
    {children}
    <div className="vr-toast-region" aria-label="Notifications" aria-live="polite" aria-relevant="additions text">
      {toasts.map((item) => <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />)}
    </div>
  </ToastContext.Provider>
}

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used within ToastProvider')
  return toast
}

function ToastItem({ item, onDismiss }) {
  const Icon = item.variant === 'error' ? AlertCircle : item.variant === 'warning' ? TriangleAlert : item.variant === 'info' ? Info : CheckCircle2
  return <section className={`vr-toast vr-toast--${item.variant}`} role={item.variant === 'error' ? 'alert' : 'status'}>
    <Icon size={19} aria-hidden="true" />
    <div className="vr-toast-copy"><strong>{item.title}</strong>{item.message && <p>{item.message}</p>}</div>
    <Button variant="subtle" className="vr-toast-dismiss" aria-label="Dismiss notification" onClick={onDismiss}><X size={16} /></Button>
  </section>
}

export function Skeleton({ className = '', width, height, circle = false }) {
  return <span aria-hidden="true" className={`vr-skeleton${circle ? ' vr-skeleton--circle' : ''} ${className}`.trim()} style={{ width, height }} />
}

export function EmptyState({ Icon = Info, title, description, action }) {
  return <section className="vr-empty-state">
    <span className="vr-empty-icon"><Icon size={22} /></span>
    <h2>{title}</h2>
    <p>{description}</p>
    {action}
  </section>
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, compact = false }) {
  return <section className={`vr-error-state${compact ? ' vr-error-state--compact' : ''}`} role="alert">
    <span className="vr-error-icon"><AlertCircle size={compact ? 16 : 21} /></span>
    <div><strong>{title}</strong><p>{description}</p></div>
    {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
  </section>
}
