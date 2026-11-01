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
  generate: () => Promise<GenerateResult | null>
  reset: () => Promise<void>
  approveProposal: () => Promise<boolean>
  rejectProposal: () => Promise<boolean>
  uploadDataset: (file: File) => Promise<DatasetInfo | null>
  uploadDisruption: (file: File) => Promise<DisruptionResult | null>
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

  const generate = async (): Promise<GenerateResult | null> => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.generate(actor)
      setGenerateResult(result)
      setDisruptionResult(null)
      await refresh()
      return result
    } catch (caught) {
      setError(messageOf(caught))
      return null
    } finally {
      setBusy(false)
    }
  }

  const reset = () =>
    run(async () => {
      await api.reset(actor)
      setGenerateResult(null)
      setDisruptionResult(null)
      await refresh()
    })

  const approveProposal = async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await api.approveProposal(actor)
      await refresh()
      return true
    } catch (caught) {
      setError(messageOf(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  const rejectProposal = async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await api.rejectProposal(actor)
      setDisruptionResult(null)
      await refresh()
      return true
    } catch (caught) {
      setError(messageOf(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  const setPriorityOrder = (order: string[]) =>
    run(async () => {
      await api.setPolicy(order, actor)
      setGenerateResult(null)
      setDisruptionResult(null)
      await refresh()
    })

  const uploadDataset = async (file: File): Promise<DatasetInfo | null> => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.importDataset(file, actor)
      setGenerateResult(null)
      setDisruptionResult(null)
      await refresh()
      return result
    } catch (caught) {
      setError(messageOf(caught))
      return null
    } finally {
      setBusy(false)
    }
  }

  const uploadDisruption = async (file: File): Promise<DisruptionResult | null> => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.disruption(file, actor)
      setDisruptionResult(result)
      await refresh()
      return result
    } catch (caught) {
      setError(messageOf(caught))
      return null
    } finally {
      setBusy(false)
    }
  }

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
