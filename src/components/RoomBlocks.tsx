import { useState } from 'react'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { api, type RoomBlock } from '../lib/api'
import type { SessionUser } from '../lib/auth'

const PERIODS = Array.from({ length: 13 }, (_, index) => index + 1)

export function RoomBlocks({
  user,
  rooms,
  days,
  blocks,
  onChanged,
}: {
  user: SessionUser
  rooms: { id: string; name: string }[]
  days: string[]
  blocks: RoomBlock[]
  onChanged: (blocks: RoomBlock[]) => void
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [day, setDay] = useState(days[0] ?? 'MON')
  const [periods, setPeriods] = useState<number[]>([])
  const [reason, setReason] = useState('Permanently allocated')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    if (!roomId || periods.length === 0) {
      setError('Choose a room and at least one period.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.addRoomBlock(
        { room_id: roomId, day, periods: [...periods].sort((a, b) => a - b), reason: reason.trim() || 'Reserved' },
        user.username,
      )
      onChanged(result.items)
      setPeriods([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the block.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (index: number) => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.deleteRoomBlock(index, user.username)
      onChanged(result.items)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove the block.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cit-card mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Lock className="h-4 w-4 text-neutral-700" aria-hidden /> Permanent room blocks (admin)
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        A block repeats every week on that weekday and period. Existing classes, approved events or
        exams make a block impossible; the API refuses it and names the conflict. Bookings are
        blocked immediately.
      </p>

      {error && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          Room
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Day
          <select
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {days.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PERIODS.map((period) => {
          const active = periods.includes(period)
          return (
            <button
              key={period}
              type="button"
              onClick={() =>
                setPeriods((current) =>
                  active ? current.filter((value) => value !== period) : [...current, period],
                )
              }
              aria-pressed={active}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              P{period}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        P1–P9 teaching, P10–P13 event-only. Blocks are hard constraints for every role.
      </p>

      <button
        type="button"
        onClick={() => void add()}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
        Add block
      </button>

      <ul className="mt-4 divide-y divide-slate-100">
        {blocks.length === 0 ? (
          <li className="py-2 text-sm text-slate-400">No blocks recorded.</li>
        ) : (
          blocks.map((block, index) => (
            <li key={`${block.room_id}-${block.day}-${block.periods.join('-')}-${index}`} className="flex items-start justify-between gap-3 py-2">
              <div className="text-xs text-slate-700">
                <p className="font-semibold text-slate-800">
                  {rooms.find((room) => room.id === block.room_id)?.name ?? block.room_id} · {block.day}{' '}
                  · P{block.periods.join(', P')}
                </p>
                <p className="text-slate-500">{block.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => void remove(index)}
                disabled={busy}
                aria-label={`Remove block ${index + 1}`}
                className="rounded p-1 text-slate-400 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
