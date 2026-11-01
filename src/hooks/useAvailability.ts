import { useEffect, useState } from 'react'
import { api, type BookingDraft, type OccupancyCheck } from '../lib/api'
import type { SessionUser } from '../lib/auth'

/** Debounced live occupancy for the booking form's dates/time/room. */
export function useAvailability(
  draft: BookingDraft | null,
  user: SessionUser | null,
  enabled = true,
): { checks: OccupancyCheck[] | null; loading: boolean } {
  const [checks, setChecks] = useState<OccupancyCheck[] | null>(null)
  const [loading, setLoading] = useState(false)

  const dates = draft?.dates ?? []
  const slotWindow = draft?.windows[0]
  const from = slotWindow?.from_period ?? null
  const to = slotWindow?.to_period ?? null
  const room = draft?.requested_room ?? null
  const roomTypes = draft?.room_types ?? []
  const attendance = draft?.attendance ?? null
  const groups = draft?.mandatory_for_groups ?? []
  const needs = draft?.needs ?? []
  const key = JSON.stringify({ dates, from, to, room, roomTypes, attendance, groups, needs })

  useEffect(() => {
    if (!enabled || !user || dates.length === 0 || !from || !to) {
      setChecks(null)
      return undefined
    }
    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      api
        .availability(
          {
            dates,
            from_period: from,
            to_period: to,
            room_id: room,
            room_types: roomTypes,
            attendance,
            mandatory_for_groups: groups,
            needs,
          },
          user.username,
        )
        .then((result) => {
          if (active) setChecks(result.checks)
        })
        .catch(() => {
          if (active) setChecks(null)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, user?.username])

  return { checks, loading }
}
