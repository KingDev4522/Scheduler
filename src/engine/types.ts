import type { Day } from '../lib/time'
import type { RoomType } from '../lib/store'

/** Engine-facing contracts. Independent of the UI data layer by design. */

export interface EngineRoom {
  id: string
  name: string
  capacity: number
  type: RoomType
  accessible: boolean
  features: string[]
}

export interface EngineFaculty {
  id: string
  name: string
  dailyLimit: number
  /** Periods the faculty cannot teach, per day (H07). */
  unavailable: { day: Day; periods: number[] }[]
}

export interface EngineGroup {
  id: string
  name: string
  size: number
}

export interface EngineSession {
  id: string
  courseCode: string
  courseName: string
  facultyId: string
  groupId: string
  periods: number
  kind: 'lecture' | 'lab'
  /** H14: a fixed-slot session must keep this placement. */
  fixed?: Placement
}

/** An approved booking blocks a room window (H13). */
export interface BlockedWindow {
  bookingId: string
  roomId: string
  day: Day
  startPeriod: number
  periods: number
}

/** A disruption closes a room for a window (H08). */
export interface RoomUnavailable {
  reason: string
  roomId: string
  day: Day
  startPeriod: number
  periods: number
}

export interface EngineInput {
  rooms: EngineRoom[]
  faculty: EngineFaculty[]
  groups: EngineGroup[]
  sessions: EngineSession[]
  blocked: BlockedWindow[]
  roomUnavailable: RoomUnavailable[]
}

export interface Placement {
  sessionId: string
  day: Day
  startPeriod: number
  periods: number
  roomId: string
}

export interface Violation {
  code: string
  message: string
  sessionIds: string[]
}

export type EngineStatus = 'FEASIBLE' | 'INFEASIBLE' | 'TIMEOUT'

export interface SolverMetrics {
  durationMs: number
  nodes: number
  placements: number
  softPenalty: number
}

export interface SolveResult {
  status: EngineStatus
  placements: Placement[]
  unplacedSessionIds: string[]
  violations: Violation[]
  metrics: SolverMetrics
  message: string
}

export interface RepairResult {
  status: EngineStatus
  affectedSessionIds: string[]
  /** Placements the affected sessions had before the disruption. */
  before: Placement[]
  /** Proposed placements for the affected sessions. */
  after: Placement[]
  /** Affected sessions whose placement actually changed. */
  movedCount: number
  /** Hard violations remaining in the merged schedule (should be 0). */
  violations: Violation[]
  metrics: SolverMetrics
  message: string
}

export interface EngineOptions {
  /** Hard stop. A timeout is not proof of infeasibility. */
  timeBudgetMs?: number
}
