export const MAX_DURATION_HOURS = 8
export const MAX_DURATION_MINUTES = MAX_DURATION_HOURS * 60

export interface Court {
  id: string
  name: string
  floor: string
  sport: string
}

export interface Booking {
  id: string
  courtId: string
  customer: string
  startsAt: string
  durationMinutes: number
  createdAt: string
  cancellation: { reason: string; cancelledAt: string } | null
}

export interface BookingDraft {
  courtId: string
  customer: string
  date: string
  time: string
  duration: string
}

export type BookingStatus = 'ongoing' | 'scheduled' | 'completed' | 'cancelled'
export type SortOrder = 'status' | 'time' | 'court'
export type BookingErrors = Partial<Record<keyof BookingDraft | 'conflict', string>>

export const STATUS: Record<BookingStatus, { label: string; rank: number }> = {
  ongoing: { label: 'Em andamento', rank: 0 },
  scheduled: { label: 'Agendado', rank: 1 },
  completed: { label: 'Concluído', rank: 2 },
  cancelled: { label: 'Cancelado', rank: 3 },
}

export const INITIAL_COURTS: Court[] = [
  { id: 'court-1', name: 'Quadra 01', floor: 'Madeira', sport: 'Futsal' },
  { id: 'court-2', name: 'Quadra 02', floor: 'Sintético', sport: 'Vôlei' },
  { id: 'court-3', name: 'Quadra 03', floor: 'Saibro', sport: 'Tênis' },
]

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseStart(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const parsed = new Date(`${date}T${time}:00`)
  if (!Number.isFinite(parsed.getTime()) || localDate(parsed) !== date) return null
  if (`${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}` !== time) return null
  return parsed
}

export function endTime(booking: Pick<Booking, 'startsAt' | 'durationMinutes'>): Date {
  return new Date(new Date(booking.startsAt).getTime() + booking.durationMinutes * 60_000)
}

export function getStatus(booking: Booking, now = new Date()): BookingStatus {
  if (booking.cancellation) return 'cancelled'
  if (now.getTime() >= endTime(booking).getTime()) return 'completed'
  if (now.getTime() >= new Date(booking.startsAt).getTime()) return 'ongoing'
  return 'scheduled'
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours}h` : '', rest ? `${rest}min` : ''].filter(Boolean).join(' ') || '0min'
}

export function hasOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

export function bookingsOnDate(booking: Booking, date: string): boolean {
  const dayStart = parseStart(date, '00:00')
  if (!dayStart) return false
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)
  return hasOverlap(new Date(booking.startsAt), endTime(booking), dayStart, nextDay)
}

export function validateBooking(draft: BookingDraft, courts: Court[], bookings: Booking[]): BookingErrors {
  const errors: BookingErrors = {}
  if (!courts.some((court) => court.id === draft.courtId)) errors.courtId = 'Selecione uma quadra.'
  if (!draft.customer.trim()) errors.customer = 'Informe o nome do responsável pela reserva.'
  else if (draft.customer.trim().length > 80) errors.customer = 'Use até 80 caracteres.'
  if (!draft.date) errors.date = 'Informe a data do agendamento.'
  if (!draft.time) errors.time = 'Informe o horário de início.'
  const start = parseStart(draft.date, draft.time)
  if (draft.date && draft.time && !start) errors.date = 'Informe uma data e um horário válidos.'
  const duration = Number(draft.duration)
  if (!draft.duration.trim() || !Number.isInteger(duration) || duration < 1) {
    errors.duration = 'A duração é obrigatória. Informe minutos inteiros, a partir de 1.'
  } else if (duration > MAX_DURATION_MINUTES) {
    errors.duration = `Cada agendamento pode durar no máximo ${MAX_DURATION_HOURS} horas (${MAX_DURATION_MINUTES} minutos).`
  }
  if (start && !errors.duration && !errors.courtId) {
    const end = new Date(start.getTime() + duration * 60_000)
    const conflict = bookings.find((booking) =>
      booking.courtId === draft.courtId && !booking.cancellation &&
      hasOverlap(start, end, new Date(booking.startsAt), endTime(booking)),
    )
    if (conflict) {
      errors.conflict = `Esta quadra já tem uma reserva de ${formatDate(conflict.startsAt)} às ${formatTime(conflict.startsAt)} até ${formatDate(endTime(conflict))} às ${formatTime(endTime(conflict))}. Escolha outro horário ou outra quadra.`
    }
  }
  return errors
}

export function sortBookings(bookings: Booking[], courts: Court[], order: SortOrder, now: Date): Booking[] {
  return [...bookings].sort((a, b) => {
    const chronological = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    if (order === 'status') {
      const aStatus = getStatus(a, now)
      const bStatus = getStatus(b, now)
      const priority = STATUS[aStatus].rank - STATUS[bStatus].rank
      if (priority) return priority
      if (aStatus === 'completed') {
        const recentEnd = endTime(b).getTime() - endTime(a).getTime()
        if (recentEnd) return recentEnd
      }
    }
    if (order === 'court') {
      const nameA = courts.find((court) => court.id === a.courtId)?.name ?? ''
      const nameB = courts.find((court) => court.id === b.courtId)?.name ?? ''
      const byCourt = nameA.localeCompare(nameB, 'pt-BR', { numeric: true })
      if (byCourt) return byCourt
    }
    return chronological || a.id.localeCompare(b.id)
  })
}

export function cancelBooking(booking: Booking, reason: string, now = new Date()): Booking {
  if (!reason.trim()) throw new Error('Informe o motivo do cancelamento.')
  if (reason.trim().length > 300) throw new Error('Use até 300 caracteres no motivo.')
  const status = getStatus(booking, now)
  if (status === 'cancelled') throw new Error('Este agendamento já foi cancelado.')
  if (status === 'completed') throw new Error('Um agendamento concluído não pode ser cancelado.')
  return { ...booking, cancellation: { reason: reason.trim(), cancelledAt: now.toISOString() } }
}
