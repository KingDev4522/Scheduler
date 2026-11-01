import type { BoardRow } from '../lib/bookingBoard'
import { formatSlot, formatSlotTime, TIER_LABEL } from '../lib/bookingBoard'
import { cn } from '../lib/utils'
import { StatusPill } from './BookingStatus'

function TierChip({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-1 py-px text-[11px] font-medium',
        tier === 1
          ? 'border-transparent bg-neutral-900 text-white'
          : tier === 2
            ? 'border-slate-200 bg-slate-100 text-slate-700'
            : 'border-slate-200 bg-white text-slate-500',
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  )
}

function SlotCell({ row }: { row: BoardRow }) {
  const asked = row.windows[0]
  return (
    <>
      <p className="truncate text-[14px] text-slate-800">
        {row.roomName ?? 'No venue assigned'}
      </p>
      <p className="mt-0.5 truncate text-[12px] tabular-nums text-slate-500">
        {row.granted
          ? `${formatSlot(row.granted)} · ${formatSlotTime(row.granted)}`
          : 'no slot granted'}
      </p>
      {row.moved && asked ? (
        <p className="mt-0.5 truncate text-[12px] text-amber-700">
          asked {formatSlot(asked)}
        </p>
      ) : null}
    </>
  )
}

export function RequestLedger({
  rows,
  selectedId,
  onSelect,
  onClearFilters,
}: {
  rows: BoardRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClearFilters: () => void
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
        <p className="text-[14px] font-medium text-slate-800">No requests match these filters</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
          Every request on the board is still here. Clear the filters to bring the full Spectra week
          back.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
        >
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            The {rows.length} venue requests on the Spectra board, with the slot each one was granted.
          </caption>
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[23%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200">
              <th
                scope="col"
                className="px-4 py-2.5 text-[12px] font-medium text-slate-500"
              >
                Request
              </th>
              <th scope="col" className="px-3 py-2.5 text-[12px] font-medium text-slate-500">
                Venue and slot
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-[12px] font-medium text-slate-500"
              >
                Expected
              </th>
              <th scope="col" className="px-3 py-2.5 text-[12px] font-medium text-slate-500">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-slate-500">
                Decision
              </th>
            </tr>
          </thead>
          <tbody className="cit-stagger-rows">
            {rows.map((row) => {
              const active = row.id === selectedId
              return (
                <tr
                  key={row.id}
                  id={`ledger-${row.id}`}
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    'cursor-pointer border-b border-slate-100 align-middle transition-colors duration-150 last:border-b-0',
                    active ? 'bg-slate-100' : 'hover:bg-slate-50',
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="truncate text-[14px] font-semibold text-slate-900" title={row.title}>
                      {row.title}
                    </p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-slate-500">
                      <span className="shrink-0 tabular-nums">{row.id}</span>
                      <TierChip tier={row.tier} />
                      <span className="truncate">{row.requester}</span>
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <SlotCell row={row} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p
                      className={cn(
                        'text-[14px] tabular-nums',
                        row.oversized ? 'font-medium text-rose-700' : 'text-slate-800',
                      )}
                    >
                      {row.attendance.toLocaleString('en-GB')}
                    </p>
                    <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                      {row.roomCapacity ? `of ${row.roomCapacity}` : 'no venue'}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <p
                      className="line-clamp-2 text-[12px] leading-relaxed text-slate-600"
                      title={row.reason}
                    >
                      {row.reason || 'No reason recorded.'}
                    </p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="cit-stagger space-y-2 lg:hidden">
        {rows.map((row) => {
          const active = row.id === selectedId
          return (
            <li key={row.id} id={`ledger-m-${row.id}`}>
              <article
                onClick={() => onSelect(row.id)}
                className={cn(
                  'cursor-pointer rounded-xl border bg-white p-3.5 transition-colors duration-150',
                  active ? 'border-slate-400 bg-slate-50' : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{row.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                      <span className="tabular-nums">{row.id}</span>
                      <TierChip tier={row.tier} />
                      <span className="truncate">{row.requester}</span>
                    </p>
                  </div>
                  <StatusPill status={row.status} className="shrink-0" />
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <dt className="text-[12px] text-slate-500">Venue</dt>
                    <dd className="truncate text-[13px] text-slate-800">
                      {row.roomName ?? 'No venue'}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[12px] text-slate-500">Slot</dt>
                    <dd className="truncate text-[13px] tabular-nums text-slate-800">
                      {row.granted ? formatSlot(row.granted) : 'none'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-slate-500">Expected</dt>
                    <dd
                      className={cn(
                        'text-[13px] tabular-nums',
                        row.oversized ? 'font-medium text-rose-700' : 'text-slate-800',
                      )}
                    >
                      {row.attendance.toLocaleString('en-GB')}
                      {row.roomCapacity ? (
                        <span className="text-slate-500"> of {row.roomCapacity}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-slate-500">Tier</dt>
                    <dd className="text-[13px] text-slate-800">{TIER_LABEL[row.tier]}</dd>
                  </div>
                </dl>

                {row.moved && row.windows[0] ? (
                  <p className="mt-2 text-[12px] text-amber-700">
                    Asked for {formatSlot(row.windows[0])}
                  </p>
                ) : null}

                {row.reason ? (
                  <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-slate-600">
                    {row.reason}
                  </p>
                ) : null}
              </article>
            </li>
          )
        })}
      </ul>
    </>
  )
}
