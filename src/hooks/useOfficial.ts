import { useCallback, useEffect, useState } from 'react'
import {
  api,
  type DatasetInfo,
  type DisruptionResult,
  type GenerateResult,
  type Health,
  type ScheduleResponse,
} from '../lib/api'
import { useAuth } from '../lib/auth'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed.'
}

export interface OfficialState {
  health: Health | null
  dataset: DatasetInfo | null
  schedule: ScheduleResponse | null
  loading: boolean
  busy: boolean
  error: string | null
  generateResult: GenerateResult | null
  disruptionResult: DisruptionResult | null
  refresh: () => Promise<void>
  generate: () => Promise<void>
  reset: () => Promise<void>
  approveProposal: () => Promise<void>
  rejectProposal: () => Promise<void>
  uploadDataset: (file: File) => Promise<void>
  uploadDisruption: (file: File) => Promise<void>
  setPriorityOrder: (order: string[]) => Promise<void>
}

/** Loads backend state and exposes the judge-workflow actions. */
export function useOfficial(): OfficialState {
  const { user } = useAuth()
  const actor = user?.username ?? 'debjeet'

  const [health, setHealth] = useState<Health | null>(null)
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)
  const [disruptionResult, setDisruptionResult] = useState<DisruptionResult | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const nextHealth = await api.health(actor)
      setHealth(nextHealth)
      setDataset(await api.dataset(actor))
      setSchedule(nextHealth.generated ? await api.schedule(actor) : null)
      setError(null)
    } catch (caught) {
      setHealth(null)
      setDataset(null)
      setSchedule(null)
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }, [actor])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const generate = () =>
    run(async () => {
      const result = await api.generate(actor)
      setGenerateResult(result)
      setDisruptionResult(null)
      await refresh()
    })

  const reset = () =>
    run(async () => {
      await api.reset(actor)
      setGenerateResult(null)
      setDisruptionResult(null)
      await refresh()
    })

  const approveProposal = () =>
    run(async () => {
      await api.approveProposal(actor)
      await refresh()
    })

  const rejectProposal = () =>
    run(async () => {
      await api.rejectProposal(actor)
      setDisruptionResult(null)
      await refresh()
    })

  const setPriorityOrder = (order: string[]) =>
    run(async () => {
      await api.setPolicy(order, actor)
      setGenerateResult(null)
      setDisruptionResult(null)
      await refresh()
    })

  const uploadDataset = (file: File) =>
    run(async () => {
      await api.importDataset(file, actor)
      setGenerateResult(null)
      setDisruptionResult(null)
      await refresh()
    })

  const uploadDisruption = (file: File) =>
    run(async () => {
      const result = await api.disruption(file, actor)
      setDisruptionResult(result)
      await refresh()
    })

  return {
    health,
    dataset,
    schedule,
    loading,
    busy,
    error,
    generateResult,
    disruptionResult,
    refresh,
    generate,
    reset,
    approveProposal,
    rejectProposal,
    uploadDataset,
    uploadDisruption,
    setPriorityOrder,
  }
}
