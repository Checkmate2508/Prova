import { useState } from 'react'
import type { FormEvent } from 'react'
import { endTime, formatDate, formatDuration, formatTime, localDate, MAX_DURATION_MINUTES, parseStart } from '../domain'
import type { BookingDraft, BookingErrors, Court } from '../domain'
import { Icon } from './Icon'

export function BookingForm({ courts, courtId, date, onSubmit, onClose }: {
  courts: Court[]
  courtId: string
  date: string
  onSubmit: (draft: BookingDraft) => BookingErrors
  onClose: () => void
}) {
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const next = new Date()
    next.setMinutes(Math.ceil((next.getMinutes() + 1) / 30) * 30, 0, 0)
    return {
      courtId: courtId || courts[0]?.id || '', customer: '',
      date: !date || date === localDate(new Date()) ? localDate(next) : date,
      time: `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`,
      duration: '60',
    }
  })
  const [errors, setErrors] = useState<BookingErrors>({})
  const court = courts.find((item) => item.id === draft.courtId)
  const start = parseStart(draft.date, draft.time)
  const duration = Number(draft.duration)
  const end = start && Number.isInteger(duration) && duration > 0 && duration <= MAX_DURATION_MINUTES
    ? endTime({ startsAt: start.toISOString(), durationMinutes: duration }) : null

  function update(field: keyof BookingDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, conflict: undefined }))
  }
  function submit(event: FormEvent) { event.preventDefault(); setErrors(onSubmit(draft)) }

  return <form onSubmit={submit} noValidate>
    <div className="form-body">
      <label className="field" htmlFor="booking-court">Quadra <span className="required">*</span>
        <select id="booking-court" value={draft.courtId} onChange={(event) => update('courtId', event.target.value)} required autoFocus aria-invalid={!!errors.courtId} aria-describedby={errors.courtId ? 'court-error' : 'court-details'}>
          <option value="" disabled>Selecione uma quadra</option>{courts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>{errors.courtId && <span id="court-error" className="field-error">{errors.courtId}</span>}
      </label>
      <div id="court-details" className="court-details"><Icon name="court" size={18} /><span>{court ? `${court.sport} · Piso ${court.floor.toLocaleLowerCase('pt-BR')}` : 'Cada agendamento utiliza uma única quadra.'}</span><span className="single-court">1 quadra</span></div>
      <label className="field" htmlFor="booking-customer">Responsável pela reserva <span className="required">*</span>
        <input id="booking-customer" placeholder="Nome da pessoa ou equipe" autoComplete="name" maxLength={80} value={draft.customer} onChange={(event) => update('customer', event.target.value)} required aria-invalid={!!errors.customer} aria-describedby={errors.customer ? 'customer-error' : undefined} />
        {errors.customer && <span id="customer-error" className="field-error">{errors.customer}</span>}
      </label>
      <div className="form-columns">
        <label className="field" htmlFor="booking-date">Data <span className="required">*</span>
          <input id="booking-date" type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required aria-invalid={!!errors.date} aria-describedby={errors.date ? 'date-error' : undefined} />
          {errors.date && <span id="date-error" className="field-error">{errors.date}</span>}
        </label>
        <label className="field" htmlFor="booking-time">Início <span className="required">*</span>
          <input id="booking-time" type="time" value={draft.time} onChange={(event) => update('time', event.target.value)} required aria-invalid={!!errors.time} aria-describedby={errors.time ? 'time-error' : undefined} />
          {errors.time && <span id="time-error" className="field-error">{errors.time}</span>}
        </label>
      </div>
      <div className="duration-section">
        <label className="field" htmlFor="booking-duration"><span>Duração <span className="required">*</span></span>
          <div className="input-with-unit"><input id="booking-duration" type="number" inputMode="numeric" min="1" max={MAX_DURATION_MINUTES} step="1" value={draft.duration} onChange={(event) => update('duration', event.target.value)} required aria-invalid={!!errors.duration} aria-describedby={errors.duration ? 'duration-error duration-help' : 'duration-help'} /><span>minutos</span></div>
          {errors.duration && <span id="duration-error" className="field-error">{errors.duration}</span>}
        </label>
        <div className="duration-presets" aria-label="Durações sugeridas">{[30, 60, 90, 120].map((minutes) => <button key={minutes} className={duration === minutes ? 'selected' : ''} type="button" aria-pressed={duration === minutes} onClick={() => update('duration', String(minutes))}>{formatDuration(minutes)}</button>)}</div>
        <p id="duration-help" className="field-hint"><Icon name="info" size={15} />Obrigatória, de 1 a 480 minutos. Limite de 8 horas.</p>
      </div>
      <div className="booking-summary"><span className="summary-icon"><Icon name="clock" /></span><div><span>Término previsto</span><strong>{end ? `${formatTime(end)}${start && localDate(start) !== localDate(end) ? ` · ${formatDate(end)}` : ''}` : 'Informe uma duração válida'}</strong></div><span className="summary-duration">{end ? formatDuration(duration) : '—'}</span></div>
      {errors.conflict && <div className="alert error" role="alert"><Icon name="warning" /><span>{errors.conflict}</span></div>}
      {Object.entries(errors).some(([key, value]) => key !== 'conflict' && !!value) && <p role="alert" className="field-error">Confira os campos indicados antes de agendar.</p>}
      <p className="form-note"><Icon name="shield" size={16} />A disponibilidade é conferida ao confirmar a reserva.</p>
    </div>
    <div className="dialog-footer"><button type="button" className="button secondary" onClick={onClose}>Voltar</button><button type="submit" className="button primary"><Icon name="check" size={18} />Confirmar agendamento</button></div>
  </form>
}
