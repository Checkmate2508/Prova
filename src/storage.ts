import { createInitialBookings, INITIAL_COURTS, MAX_DURATION_MINUTES } from './domain'
import type { Booking, Court } from './domain'

export const STORAGE_KEY = 'arena-agendamentos-v1'

export interface AppData {
  courts: Court[]
  bookings: Booking[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const isDate = (value: unknown): value is string => isText(value) && Number.isFinite(Date.parse(value))

function isCourt(value: unknown): value is Court {
  return isRecord(value) && ['id', 'name', 'floor', 'sport'].every((key) => isText(value[key]))
}

function isBooking(value: unknown): value is Booking {
  if (!isRecord(value)) return false
  return isText(value.id) && isText(value.courtId) && isText(value.customer) &&
    isDate(value.startsAt) && isDate(value.createdAt) &&
    typeof value.durationMinutes === 'number' && Number.isInteger(value.durationMinutes) &&
    value.durationMinutes >= 1 && value.durationMinutes <= MAX_DURATION_MINUTES &&
    (value.cancellation === null || (isRecord(value.cancellation) &&
      isText(value.cancellation.reason) && isDate(value.cancellation.cancelledAt)))
}

export function readData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = { courts: INITIAL_COURTS, bookings: createInitialBookings() }
    writeData(initial)
    return initial
  }
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.courts) ||
    !Array.isArray(parsed.bookings) || !parsed.courts.every(isCourt) || !parsed.bookings.every(isBooking)) {
    throw new Error('Os dados salvos não puderam ser lidos.')
  }
  const courts = parsed.courts as Court[]
  const bookings = parsed.bookings as Booking[]
  if (new Set(courts.map((court) => court.id)).size !== courts.length ||
    new Set(bookings.map((booking) => booking.id)).size !== bookings.length ||
    bookings.some((booking) => !courts.some((court) => court.id === booking.courtId))) {
    throw new Error('Os dados salvos estão inconsistentes.')
  }
  return { courts, bookings }
}

export function writeData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...data }))
}
