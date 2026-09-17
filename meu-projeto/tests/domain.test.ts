import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookingsOnDate, cancelBooking, endTime, getStatus, INITIAL_COURTS, localDate, MAX_DURATION_HOURS, MAX_DURATION_MINUTES, parseStart, sortBookings, validateBooking } from '../src/domain.ts'
import type { Booking, BookingDraft } from '../src/domain.ts'

const courts = INITIAL_COURTS
const now = new Date('2030-06-15T12:00:00')
const draft: BookingDraft = { courtId: 'court-1', customer: 'Equipe Azul', date: '2030-06-15', time: '14:00', duration: '60' }
function booking(time: string, duration = 60, courtId = 'court-1', id = 'booking-1'): Booking {
  return { id, courtId, customer: 'Equipe Azul', startsAt: new Date(`2030-06-15T${time}:00`).toISOString(), durationMinutes: duration, createdAt: now.toISOString(), cancellation: null }
}

test('aplica o parâmetro 8: aceita 480 minutos e rejeita 481', () => {
  assert.equal(MAX_DURATION_HOURS, 8)
  assert.equal(MAX_DURATION_MINUTES, 480)
  assert.deepEqual(validateBooking({ ...draft, duration: '480' }, courts, []), {})
  assert.match(validateBooking({ ...draft, duration: '481' }, courts, []).duration!, /8 horas/)
})
test('duração é obrigatória, inteira e positiva', () => {
  for (const duration of ['', ' ', '0', '-1', '1.5', 'abc', 'Infinity']) {
    assert.ok(validateBooking({ ...draft, duration }, courts, []).duration, `Deveria rejeitar ${JSON.stringify(duration)}`)
  }
  assert.deepEqual(validateBooking({ ...draft, duration: '1' }, courts, []), {})
})
test('exige uma única quadra válida e um responsável', () => {
  for (const courtId of ['', 'inexistente', 'court-1,court-2']) assert.ok(validateBooking({ ...draft, courtId }, courts, []).courtId)
  assert.ok(validateBooking({ ...draft, customer: ' ' }, courts, []).customer)
})
test('rejeita data impossível, horário inválido e campos ausentes', () => {
  assert.equal(parseStart('2030-02-30', '14:00'), null)
  assert.equal(parseStart('2030-06-15', '25:00'), null)
  assert.equal(parseStart('2030-06-15', '24:00'), null)
  assert.ok(validateBooking({ ...draft, date: '' }, courts, []).date)
  assert.ok(validateBooking({ ...draft, time: '' }, courts, []).time)
  assert.ok(validateBooking({ ...draft, date: '2030-02-30' }, courts, []).date)
})
test('impede duplicata, sobreposição parcial e intervalos contidos', () => {
  const existing = booking('14:00', 120)
  for (const [time, duration] of [['14:00', '120'], ['13:30', '60'], ['15:30', '60'], ['14:30', '30'], ['13:00', '240']]) {
    assert.ok(validateBooking({ ...draft, time, duration }, courts, [existing]).conflict, `Conflito em ${time} / ${duration}`)
  }
})
test('permite reservas consecutivas sem intervalo entre elas', () => {
  const existing = booking('14:00', 120)
  assert.deepEqual(validateBooking({ ...draft, time: '13:00' }, courts, [existing]), {})
  assert.deepEqual(validateBooking({ ...draft, time: '16:00' }, courts, [existing]), {})
})
test('permite horários iguais em quadras diferentes', () => {
  assert.deepEqual(validateBooking({ ...draft, courtId: 'court-2' }, courts, [booking('14:00')]), {})
})
test('detecta conflito quando a reserva atravessa a meia-noite', () => {
  const night = booking('23:00', 120)
  assert.ok(validateBooking({ ...draft, date: '2030-06-16', time: '00:30' }, courts, [night]).conflict)
  assert.deepEqual(validateBooking({ ...draft, date: '2030-06-16', time: '01:00' }, courts, [night]), {})
})
test('calcula corretamente o término no dia seguinte', () => {
  const end = endTime(booking('23:00', 120))
  assert.equal(localDate(end), '2030-06-16')
  assert.equal(end.getHours(), 1)
  assert.equal(end.getMinutes(), 0)
})
test('a agenda inclui reservas que começaram no dia anterior', () => {
  const night = booking('23:00', 120)
  assert.equal(bookingsOnDate(night, '2030-06-15'), true)
  assert.equal(bookingsOnDate(night, '2030-06-16'), true)
  assert.equal(bookingsOnDate(night, '2030-06-17'), false)
  assert.equal(bookingsOnDate(booking('23:00', 60), '2030-06-16'), false)
})
test('cancelamento exige motivo e mantém o registro original intacto', () => {
  const original = booking('14:00')
  assert.throws(() => cancelBooking(original, '  ', now), /motivo/)
  assert.throws(() => cancelBooking(original, 'x'.repeat(301), now), /300/)
  const cancelled = cancelBooking(original, '  Chuva intensa  ', now)
  assert.equal(cancelled.cancellation?.reason, 'Chuva intensa')
  assert.equal(cancelled.cancellation?.cancelledAt, now.toISOString())
  assert.equal(original.cancellation, null)
  assert.equal(cancelled.durationMinutes, original.durationMinutes)
})
test('cancelamento libera o intervalo para outra reserva', () => {
  const cancelled = cancelBooking(booking('14:00'), 'Equipe desistiu', now)
  assert.deepEqual(validateBooking(draft, courts, [cancelled]), {})
  assert.equal(getStatus(cancelled, now), 'cancelled')
})
test('impede cancelar reservas concluídas ou já canceladas', () => {
  assert.throws(() => cancelBooking(booking('10:00'), 'Teste', now), /concluído/)
  const cancelled = cancelBooking(booking('14:00'), 'Teste', now)
  assert.throws(() => cancelBooking(cancelled, 'Teste', now), /já foi cancelado/)
})
test('permite cancelar uma reserva em andamento', () => {
  assert.equal(getStatus(cancelBooking(booking('11:30'), 'Interrupção da partida', now), now), 'cancelled')
})
test('situação muda exatamente nos limites de início e término', () => {
  const item = booking('14:00')
  assert.equal(getStatus(item, new Date('2030-06-15T13:59:59')), 'scheduled')
  assert.equal(getStatus(item, new Date('2030-06-15T14:00:00')), 'ongoing')
  assert.equal(getStatus(item, new Date('2030-06-15T14:59:59')), 'ongoing')
  assert.equal(getStatus(item, new Date('2030-06-15T15:00:00')), 'completed')
})
test('prioriza em andamento, próximos, concluídos recentes e cancelados', () => {
  const ongoing = booking('11:30', 60, 'court-1', 'ongoing')
  const next = booking('13:00', 60, 'court-1', 'next')
  const later = booking('16:00', 60, 'court-1', 'later')
  const older = booking('08:00', 60, 'court-1', 'older')
  const recent = booking('10:00', 60, 'court-1', 'recent')
  const cancelled = cancelBooking(booking('12:30', 60, 'court-1', 'cancelled'), 'Teste', now)
  const items = [cancelled, later, older, next, recent, ongoing]
  const result = sortBookings(items, courts, 'status', now)
  assert.deepEqual(result.map((item) => item.id), ['ongoing', 'next', 'later', 'recent', 'older', 'cancelled'])
  assert.equal(items[0].id, 'cancelled', 'Não deve modificar a lista original')
})
test('ordenação cronológica e por nome de quadra respeitam o horário', () => {
  const a = booking('16:00', 60, 'court-1', 'a')
  const b = booking('14:00', 60, 'court-2', 'b')
  const c = booking('15:00', 60, 'court-1', 'c')
  assert.deepEqual(sortBookings([a, b, c], courts, 'time', now).map((item) => item.id), ['b', 'c', 'a'])
  assert.deepEqual(sortBookings([a, b, c], courts, 'court', now).map((item) => item.id), ['c', 'a', 'b'])
})

test('concluídos são ordenados pelo término mais recente, independentemente da duração', () => {
  const long = booking('08:00', 210, 'court-1', 'long')
  const short = booking('09:00', 60, 'court-2', 'short')
  assert.deepEqual(sortBookings([short, long], courts, 'status', now).map((item) => item.id), ['long', 'short'])
})
