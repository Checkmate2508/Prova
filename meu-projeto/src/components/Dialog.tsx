import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Dialog({ title, subtitle, children, onClose, wide = false }: {
  title: string
  subtitle: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const subtitleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement as HTMLElement | null
    dialog?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={titleId} aria-describedby={subtitleId} onCancel={onClose}>
      <div className="dialog-heading">
        <div><span className="eyebrow">CENTRO ESPORTIVO</span><h2 id={titleId}>{title}</h2><p id={subtitleId}>{subtitle}</p></div>
        <button type="button" className="icon-button" aria-label="Fechar janela" onClick={onClose}><Icon name="close" /></button>
      </div>
      {children}
    </dialog>
  )
}
