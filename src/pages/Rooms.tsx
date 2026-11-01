import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Accessibility,
  CheckCircle2,
  DoorOpen,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { RoomTypeBadge } from '../components/Badges'
import { type AppData, type RoomType } from '../lib/store'
import { DAYS, type Day } from '../lib/time'
import { freeWindowLabel, roomAvailability } from '../lib/selectors'
import { useOfficial } from '../hooks/useOfficial'
import { buildOfficialView } from '../lib/official'

type TypeFilter = RoomType | 'all'

const EMPTY_DATA: AppData = {
  version: 0,
  rooms: [],
  faculty: [],
  groups: [],
  sessions: [],
  bookings: [],
  proposals: [],
  audit: [],
}

export default function Rooms() {
  const official = useOfficial()
  const officialView = useMemo(
    () =>
      official.dataset && official.schedule
        ? buildOfficialView(official.dataset, official.schedule)
        : null,
    [official.dataset, official.schedule],
  )
  const data = officialView?.data ?? EMPTY_DATA
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [minCapacity, setMinCapacity] = useState('')
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [featureFilter, setFeatureFilter] = useState('all')
  const [day, setDay] = useState<Day>('Mon')

  const features = useMemo(
    () => Array.from(new Set(data.rooms.flatMap((room) => room.features))).sort(),
    [data.rooms],
  )

  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const min = Number(minCapacity)
    return data.rooms.filter((room) => {
      if (needle && !`${room.name} ${room.building} ${room.id}`.toLowerCase().includes(needle)) {
        return false
      }
      if (typeFilter !== 'all' && room.type !== typeFilter) return false
      if (minCapacity.trim() !== '' && Number.isFinite(min) && room.capacity < min) return false
      if (accessibleOnly && !room.accessible) return false
      if (featureFilter !== 'all' && !room.features.includes(featureFilter)) return false
      return true
    })
  }, [data.rooms, query, typeFilter, minCapacity, accessibleOnly, featureFilter])

  const hasFilters =
    query.trim() !== '' ||
    typeFilter !== 'all' ||
    minCapacity.trim() !== '' ||
    accessibleOnly ||
    featureFilter !== 'all'

  const clearFilters = () => {
    setQuery('')
    setTypeFilter('all')
    setMinCapacity('')
    setAccessibleOnly(false)
    setFeatureFilter('all')
  }

  if (official.loading && !official.dataset) {
    return <PageSkeleton label="Loading the official room inventory…" variant="table" cards={4} rows={8} />
  }

  if (official.error && !official.health) {
    return (
      <div>
        <PageHeader title="Room finder" subtitle="Official room inventory" />
        <ErrorState
          title="Backend not reachable"
          description={official.error}
          onRetry={() => void official.refresh()}
        />
      </div>
    )
  }

  if (!officialView || !official.schedule) {
    return (
      <div>
        <PageHeader title="Room finder" subtitle="Official room inventory" />
        <EmptyState
          icon={DoorOpen}
          title="No official schedule yet"
          description="Generate the timetable first so room availability is computed from real placements."
          action={
            <Link
              to="/admin"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Open Import / Exports
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="cit-page">
      <PageHeader
        title="Room finder"
        subtitle="Filter every official space by capacity, type, features and accessibility. Availability uses the generated timetable and approved bookings."
      />

      <p className="mb-4 text-xs text-slate-500">
        {data.rooms.length} rooms · pending requests do not block a room until approved
      </p>

      {/* Filters */}
      <section className="cit-card mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-neutral-700" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="relative">
            <label htmlFor="room-search" className="mb-1 block text-xs font-medium text-slate-600">
              Search
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-[30px] h-4 w-4 text-slate-400"
              aria-hidden
            />
            <input
              id="room-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, building or ID"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="room-type" className="mb-1 block text-xs font-medium text-slate-600">
              Room type
            </label>
            <select
              id="room-type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="all">Any type</option>
              <option value="lecture">Lecture hall</option>
              <option value="lab">Laboratory</option>
              <option value="seminar">Seminar room</option>
              <option value="auditorium">Auditorium</option>
            </select>
          </div>

          <div>
            <label htmlFor="room-capacity" className="mb-1 block text-xs font-medium text-slate-600">
              Minimum capacity
            </label>
            <input
              id="room-capacity"
              type="number"
              min={0}
              step={10}
              value={minCapacity}
              onChange={(event) => setMinCapacity(event.target.value)}
              placeholder="e.g. 60"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="room-feature" className="mb-1 block text-xs font-medium text-slate-600">
              Feature
            </label>
            <select
              id="room-feature"
              value={featureFilter}
              onChange={(event) => setFeatureFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="all">Any feature</option>
              {features.map((feature) => (
                <option key={feature} value={feature}>
                  {feature}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="room-day" className="mb-1 block text-xs font-medium text-slate-600">
              Availability day
            </label>
            <select
              id="room-day"
              value={day}
              onChange={(event) => setDay(event.target.value as Day)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {DAYS.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekday}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={accessibleOnly}
            onChange={(event) => setAccessibleOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-neutral-900"
          />
          Accessible rooms only
        </label>
      </section>

      <p className="mb-3 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{filteredRooms.length}</span> of{' '}
        {data.rooms.length} rooms · availability for <span className="font-semibold">{day}</span>
      </p>

      {filteredRooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms match these filters"
          description="Try widening the capacity, choosing another type, or clearing the feature filter."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="cit-card hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Room</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Capacity</th>
                  <th scope="col" className="px-4 py-3">Features</th>
                  <th scope="col" className="px-4 py-3">Free on {day}</th>
                  <th scope="col" className="px-4 py-3">Access</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="cit-stagger-rows divide-y divide-slate-100">
                {filteredRooms.map((room) => {
                  const availability = roomAvailability(data, room.id, day)
                  return (
                    <tr key={room.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{room.name}</p>
                        <p className="text-xs text-slate-400">
                          {room.id} · {room.building}
                          {room.department ? ` · ${room.department}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <RoomTypeBadge type={room.type} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{room.capacity}</p>
                        <p
                          className="text-[11px] text-slate-400"
                          title="Exams use half effective capacity; rounding is VERIFY in the official validator."
                        >
                          {Math.floor(room.capacity / 2)} effective for exams
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {room.features.map((feature) => (
                            <span
                              key={feature}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700">
                          {freeWindowLabel(availability.freeWindows)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {9 - availability.occupied.size} of 9 periods free
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {room.accessible ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Step-free
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                            <XCircle className="h-3.5 w-3.5" aria-hidden />
                            Stairs only
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/bookings?room=${encodeURIComponent(room.id)}`}
                          className="inline-block rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-100"
                        >
                          Requests
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="cit-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {filteredRooms.map((room) => {
              const availability = roomAvailability(data, room.id, day)
              return (
                <article
                  key={room.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{room.name}</h3>
                      <p className="truncate text-xs text-slate-400">
                        {room.building}
                        {room.department ? ` · ${room.department}` : ''}
                      </p>
                    </div>
                    <RoomTypeBadge type={room.type} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400">Capacity</p>
                    <p className="font-medium text-neutral-800">
                        {room.capacity}{' '}
                        <span className="font-normal text-slate-400">
                          ({Math.floor(room.capacity / 2)} exams)
                        </span>
                      </p>
                    </div>
                    <div>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400">Access</p>
                    <p className="inline-flex items-center gap-1 font-medium text-neutral-700">
                        <Accessibility className="h-3.5 w-3.5" aria-hidden />
                        {room.accessible ? 'Step-free' : 'Stairs only'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      Free on {day}
                    </p>
                    <p className="text-xs font-medium text-slate-700">
                      {freeWindowLabel(availability.freeWindows)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {room.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <Link
                    to={`/bookings?room=${encodeURIComponent(room.id)}`}
                    className="mt-3 inline-block rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-100"
                  >
                    View requests for {room.name}
                  </Link>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
