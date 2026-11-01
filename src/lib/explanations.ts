import type { Booking } from './store'
import type { DatasetInfo } from './api'

export function bookingExplanation(booking: Booking, dataset: DatasetInfo | null): string {
  const request = dataset?.entities.booking_requests.find((item) => item.id === booking.id)
  const room = dataset?.entities.rooms.find((item) => item.id === booking.roomId)
  const category = request?.requested_category ?? 'requested category'
  const windows = request?.windows
    ?.map((window) => `${window.day} P${window.from_period}–P${window.to_period}`)
    .join(', ')
  const features = request?.needs?.length ? request.needs.join(', ') : 'no extra facilities'
  const slot = `${booking.day} P${booking.startPeriod}–P${booking.startPeriod + booking.periods - 1}`

  if (booking.status === 'cancelled') {
    return `${booking.id} was withdrawn by the requester. The validator treats a withdrawn request as rejected and never approves it.`
  }
  if (booking.status === 'approved') {
    return `${category} priority. ${room?.name ?? booking.roomId} seats ${room?.capacity ?? '—'} for ${booking.expectedAttendees}; type ${room?.type ?? '—'} and facilities (${features}) satisfy the request. ${slot} is inside the requested window (${windows ?? '—'}) and free of classes and approved bookings.`
  }
  if (booking.status === 'alternative_offered') {
    return `No slot inside the requested window (${windows ?? '—'}) was free. The solver offered ${room?.name ?? booking.roomId} at ${slot} outside the window; it seats ${room?.capacity ?? '—'} and satisfies ${features}.`
  }
  if (request && room && room.capacity < request.attendance) {
    return `No eligible room seats ${request.attendance}. ${room.name} is the assigned lookup room and seats ${room.capacity}; the request was rejected rather than overbooked.`
  }
  return `No eligible room/time was available inside ${windows ?? 'the requested window'}. The solver checked room type, capacity, facilities (${features}), room closures, class occupancy and mandatory-group conflicts.`
}
