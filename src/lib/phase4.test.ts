import { describe, expect, it } from 'vitest'
import { navForRole } from './nav'
import {
  canDecideBooking,
  type Actor,
  type AppData,
  type Booking,
  type Room,
} from './store'
import { visibleBookings } from './selectors'

const rooms: Room[] = [
  {
    id: 'CR-1',
    name: 'Classroom 1',
    building: 'Main',
    capacity: 60,
    type: 'lecture',
    features: ['projector'],
    accessible: true,
  },
]

const booking: Booking = {
  id: 'ADH-1',
  title: 'Club meetup',
  organizer: 'Mehul',
  requester: 'mehul',
  roomId: 'CR-1',
  day: 'Mon',
  startPeriod: 2,
  periods: 1,
  priority: 3,
  status: 'pending',
  expectedAttendees: 20,
  note: '',
  updatedAt: Date.now(),
}

const mehul: Actor = { username: 'mehul', role: 'event_manager' }
const admin: Actor = { username: 'debjeet', role: 'admin' }

describe('role navigation', () => {
  it('keeps Admin-only routes away from non-admins', () => {
    for (const role of ['event_manager', 'department_coordinator', 'faculty'] as const) {
      expect(navForRole(role).some((item) => item.path === '/admin')).toBe(false)
    }
    expect(navForRole('admin').some((item) => item.path === '/admin')).toBe(true)
  })

  it('gives every role the shared workspace and manual fallback', () => {
    for (const role of ['admin', 'event_manager', 'department_coordinator', 'faculty'] as const) {
      const paths = navForRole(role).map((item) => item.path)
      expect(paths).toContain('/workspace')
      expect(paths).toContain('/manual')
      expect(paths).toContain('/assistant')
    }
  })
})

describe('booking authorization', () => {
  it('never allows self-approval', () => {
    const permission = canDecideBooking(booking, mehul, rooms)
    expect(permission.allowed).toBe(false)
  })

  it('lets an Admin decide another user request', () => {
    expect(canDecideBooking(booking, admin, rooms).allowed).toBe(true)
  })

  it('scopes club and faculty lists to their own requests', () => {
    const data = {
      bookings: [booking, { ...booking, id: 'ADH-2', requester: 'ananya' }],
    } as AppData
    expect(visibleBookings(data, { ...mehul, displayName: 'Mehul', initials: 'M' })).toHaveLength(1)
  })
})
