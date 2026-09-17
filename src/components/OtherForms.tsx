import { useState } from 'react'
import type { FormEvent } from 'react'
import { endTime, formatDate, formatDuration, formatTime } from '../domain'
import type { Booking, Court } from '../domain'
import { Icon } from './Icon'

export function CancelForm({ booking, court, onSubmit, onClose }: { booking: Booking; court: Court; onSubmit: (id: string, reason: string) => string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) { event.preventDefault(); setError(onSubmit(booking.id, reason)) }
  return <form onSubmit={submit} noValidate><div className="form-body"><div className="cancel-booking-info"><Icon name="calendar" size={24} /><div><strong>{court.name} · {booking.customer}</strong><span>{formatDate(booking.startsAt)} · {formatTime(booking.startsAt)} – {formatTime(endTime(booking))} · {formatDuration(booking.durationMinutes)}</span></div></div><label className="field" htmlFor="cancel-reason">Motivo do cancelamento <span className="required">*</span><textarea id="cancel-reason" rows={4} maxLength={300} value={reason} placeholder="Descreva por que a reserva será cancelada..." onChange={(event) => { setReason(event.target.value); setError('') }} required autoFocus aria-invalid={!!error} aria-describedby={error ? 'cancel-error' : undefined} /></label><span className="character-count">{reason.length}/300 caracteres</span>{error && <p id="cancel-error" className="field-error" role="alert">{error}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={onClose}>Manter agendamento</button><button className="button danger" type="submit">Confirmar cancelamento</button></div></form>
}

export function CourtForm({ onSubmit, onClose }: { onSubmit: (court: Omit<Court, 'id'>) => string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [floor, setFloor] = useState('')
  const [sport, setSport] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !floor.trim() || !sport.trim()) { setError('Preencha o nome, o tipo de piso e a modalidade.'); return }
    setError(onSubmit({ name: name.trim(), floor: floor.trim(), sport: sport.trim() }))
  }
  return <form onSubmit={submit}><div className="form-body"><label className="field" htmlFor="court-name">Nome da quadra <span className="required">*</span><input id="court-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Quadra 04" required autoFocus /></label><label className="field" htmlFor="court-floor">Tipo de piso <span className="required">*</span><input id="court-floor" maxLength={40} list="floor-options" value={floor} onChange={(event) => setFloor(event.target.value)} placeholder="Ex.: Madeira" required /><datalist id="floor-options"><option value="Madeira" /><option value="Sintético" /><option value="Saibro" /><option value="Concreto" /><option value="Areia" /><option value="Grama sintética" /></datalist></label><label className="field" htmlFor="court-sport">Modalidade <span className="required">*</span><input id="court-sport" maxLength={40} list="sport-options" value={sport} onChange={(event) => setSport(event.target.value)} placeholder="Ex.: Futsal" required /><datalist id="sport-options"><option value="Futsal" /><option value="Vôlei" /><option value="Tênis" /><option value="Basquete" /><option value="Beach tennis" /><option value="Poliesportiva" /></datalist></label><p className="form-note"><Icon name="info" size={16} />A situação de uso é calculada a partir dos agendamentos.</p>{error && <p className="field-error" role="alert">{error}</p>}</div><div className="dialog-footer"><button className="button secondary" type="button" onClick={onClose}>Voltar</button><button className="button primary" type="submit"><Icon name="check" size={18} />Cadastrar quadra</button></div></form>
}

function Rule({ number, title, children }: { number: string; title: string; children: string }) {
  return <div className="rule"><span>{number}</span><div><h3>{title}</h3><p>{children}</p></div></div>
}

export function Rules({ onClose }: { onClose: () => void }) {
  return <><div className="rules-content"><div className="rule-highlight"><span>8<span>h</span></span><div><h3>Até 8 horas por agendamento</h3><p>O parâmetro 8 é aplicado no limite da duração: são permitidos de 1 a 480 minutos (8 × 60). Reservas acima desse limite são bloqueadas ao confirmar.</p></div></div><Rule number="01" title="Duração obrigatória">Cada reserva registra a duração em minutos. O sistema calcula e exibe o término, inclusive quando a reserva termina no dia seguinte.</Rule><Rule number="02" title="Uma reserva, uma quadra">O agendamento permite selecionar exatamente uma quadra. Para reservar outro espaço, crie um novo agendamento.</Rule><Rule number="03" title="Sem sobreposição de horários">Duas reservas ativas não podem ocupar a mesma quadra no mesmo intervalo. Uma pode começar exatamente quando a outra termina.</Rule><Rule number="04" title="Cancelamento com motivo">O motivo é obrigatório. O cancelamento libera o horário e mantém o registro para consulta. Reservas concluídas permanecem no histórico.</Rule><Rule number="05" title="A situação define a prioridade">Primeiro aparecem os jogos em andamento, depois os agendados por horário, os concluídos mais recentes e os cancelados. A situação é atualizada automaticamente pelo relógio.</Rule><p className="rules-storage"><Icon name="info" size={17} />Esta versão guarda dados neste navegador. Não há sincronização entre dispositivos ou recepcionistas em computadores diferentes.</p></div><div className="dialog-footer"><button className="button primary" onClick={onClose}>Entendido <Icon name="check" size={17} /></button></div></>
}
