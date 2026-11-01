import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react'
import { SOFT_EASE } from '../lib/motion'

export type Decision = 'approved' | 'rejected'

export function DecisionDialog({
  open,
  title,
  detail,
  conflicts = [],
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  detail?: string
  conflicts?: string[]
  onClose: () => void
  onSubmit: (decision: Decision, reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = (decision: Decision) => {
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setError('Add a short reason (at least 3 characters) for the audit trail.')
      return
    }
    onSubmit(decision, trimmed)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="decision-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: SOFT_EASE }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
          >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="decision-title" className="text-base font-semibold text-slate-900">
              Record a decision
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-700">{title}</p>
            {detail && <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close decision dialog"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {conflicts.length > 0 && (
          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Deterministic checks flagged {conflicts.length} issue
              {conflicts.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-neutral-700">
              {conflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-neutral-600">
              A decision is not a validation result. Approving does not override hard constraints in
              later phases.
            </p>
          </div>
        )}

        <label htmlFor="decision-reason" className="mt-4 block text-sm font-medium text-slate-700">
          Reason (required)
        </label>
        <textarea
          id="decision-reason"
          rows={3}
          autoFocus
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            if (error) setError(null)
          }}
          placeholder="e.g. Room is free at this time and the request fits capacity."
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-neutral-400"
        />
        {error && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-neutral-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit('rejected')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <XCircle className="h-4 w-4" aria-hidden />
            Reject
          </button>
          <button
            type="button"
            onClick={() => submit('approved')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-900"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Approve
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
