import { DAYS, dayIndex, occupiedPeriods, periodRangeLabel } from '../lib/time'
import type {
  EngineInput,
  EngineOptions,
  EngineSession,
  Placement,
  RepairResult,
  SolveResult,
} from './types'
import {
  candidateWindows,
  facultyUnavailable,
  roomCanHostRoomType,
  roomFitsGroup,
} from './input'
import { validatePlacements } from './validate'
import { computeSoftPenalty } from './soft'

interface Candidate {
  day: (typeof DAYS)[number]
  startPeriod: number
  roomId: string
}

interface SearchState {
  input: EngineInput
  roomById: Map<string, EngineInput['rooms'][number]>
  groupById: Map<string, EngineInput['groups'][number]>
  facultyById: Map<string, EngineInput['faculty'][number]>
  staticCandidates: Map<string, Candidate[]>
  blocked: Set<string>
  roomUsed: Set<string>
  facultyUsed: Set<string>
  groupUsed: Set<string>
  facultyDayLoad: Map<string, number>
  groupDayPeriods: Map<string, number>
  groupDayCourses: Map<string, number>
  placements: Map<string, Placement>
  deadline: number
  nodes: number
  timedOut: boolean
}

const DEFAULT_TIME_BUDGET_MS = 2_000

function key(...parts: (string | number)[]): string {
  return parts.join('|')
}

function createState(input: EngineInput, timeBudgetMs: number): SearchState {
  const state: SearchState = {
    input,
    roomById: new Map(input.rooms.map((room) => [room.id, room])),
    groupById: new Map(input.groups.map((group) => [group.id, group])),
    facultyById: new Map(input.faculty.map((faculty) => [faculty.id, faculty])),
    staticCandidates: new Map(),
    blocked: new Set(),
    roomUsed: new Set(),
    facultyUsed: new Set(),
    groupUsed: new Set(),
    facultyDayLoad: new Map(),
    groupDayPeriods: new Map(),
    groupDayCourses: new Map(),
    placements: new Map(),
    deadline: Date.now() + timeBudgetMs,
    nodes: 0,
    timedOut: false,
  }

  for (const blocked of input.blocked) {
    for (const period of occupiedPeriods(blocked.startPeriod, blocked.periods)) {
      state.blocked.add(key(blocked.roomId, blocked.day, period))
    }
  }
  for (const closure of input.roomUnavailable) {
    for (const period of occupiedPeriods(closure.startPeriod, closure.periods)) {
      state.blocked.add(key(closure.roomId, closure.day, period))
    }
  }

  return state
}

function staticCandidatesFor(state: SearchState, session: EngineSession): Candidate[] {
  const group = state.groupById.get(session.groupId)
  if (!group) return []
  const windows = candidateWindows(session.periods)
  const rooms = state.input.rooms.filter(
    (room) => roomFitsGroup(room, group) && roomCanHostRoomType(room, session),
  )
  if (windows.length === 0 || rooms.length === 0) return []

  const faculty = state.facultyById.get(session.facultyId)
  const candidates: Candidate[] = []
  for (const day of DAYS) {
    for (const window of windows) {
      if (faculty && facultyUnavailable(faculty, day, window.startPeriod, session.periods)) continue
      for (const room of rooms) {
        candidates.push({ day, startPeriod: window.startPeriod, roomId: room.id })
      }
    }
  }
  return candidates
}

/** Returns the sessions that have no legal static candidate. */
function computeStaticCandidates(state: SearchState): EngineSession[] {
  const impossible: EngineSession[] = []
  for (const session of state.input.sessions) {
    const candidates = staticCandidatesFor(state, session)
    state.staticCandidates.set(session.id, candidates)
    if (candidates.length === 0) impossible.push(session)
  }
  return impossible
}

function isAvailable(state: SearchState, session: EngineSession, candidate: Candidate): boolean {
  for (const period of occupiedPeriods(candidate.startPeriod, session.periods)) {
    const roomKey = key(candidate.roomId, candidate.day, period)
    if (state.blocked.has(roomKey)) return false
    if (state.roomUsed.has(roomKey)) return false
    if (state.facultyUsed.has(key(session.facultyId, candidate.day, period))) return false
    if (state.groupUsed.has(key(session.groupId, candidate.day, period))) return false
  }

  const faculty = state.facultyById.get(session.facultyId)
  if (faculty) {
    const load = state.facultyDayLoad.get(key(session.facultyId, candidate.day)) ?? 0
    if (load + session.periods > faculty.dailyLimit) return false
  }
  return true
}

function scoreCandidate(state: SearchState, session: EngineSession, candidate: Candidate): number {
  const group = state.groupById.get(session.groupId)
  const room = state.roomById.get(candidate.roomId)
  let score = dayIndex(candidate.day) * 1.5 + (candidate.startPeriod - 1) * 2
  if (candidate.startPeriod === 9) score += 20
  if (group && room) score += Math.max(0, room.capacity - group.size) * 0.03

  const dayLoad = state.groupDayPeriods.get(key(session.groupId, candidate.day)) ?? 0
  score += dayLoad * 1.5

  const repeats = state.groupDayCourses.get(
    key(session.groupId, candidate.day, session.courseCode),
  )
  if (repeats) score += 8

  return score
}

function applyCandidate(state: SearchState, session: EngineSession, candidate: Candidate): void {
  state.placements.set(session.id, {
    sessionId: session.id,
    day: candidate.day,
    startPeriod: candidate.startPeriod,
    periods: session.periods,
    roomId: candidate.roomId,
  })

  for (const period of occupiedPeriods(candidate.startPeriod, session.periods)) {
    state.roomUsed.add(key(candidate.roomId, candidate.day, period))
    state.facultyUsed.add(key(session.facultyId, candidate.day, period))
    state.groupUsed.add(key(session.groupId, candidate.day, period))
  }

  state.facultyDayLoad.set(
    key(session.facultyId, candidate.day),
    (state.facultyDayLoad.get(key(session.facultyId, candidate.day)) ?? 0) + session.periods,
  )
  state.groupDayPeriods.set(
    key(session.groupId, candidate.day),
    (state.groupDayPeriods.get(key(session.groupId, candidate.day)) ?? 0) + session.periods,
  )
  const courseKey = key(session.groupId, candidate.day, session.courseCode)
  state.groupDayCourses.set(courseKey, (state.groupDayCourses.get(courseKey) ?? 0) + 1)
}

function undoCandidate(state: SearchState, session: EngineSession, candidate: Candidate): void {
  state.placements.delete(session.id)

  for (const period of occupiedPeriods(candidate.startPeriod, session.periods)) {
    state.roomUsed.delete(key(candidate.roomId, candidate.day, period))
    state.facultyUsed.delete(key(session.facultyId, candidate.day, period))
    state.groupUsed.delete(key(session.groupId, candidate.day, period))
  }

  state.facultyDayLoad.set(
    key(session.facultyId, candidate.day),
    (state.facultyDayLoad.get(key(session.facultyId, candidate.day)) ?? 0) - session.periods,
  )
  state.groupDayPeriods.set(
    key(session.groupId, candidate.day),
    (state.groupDayPeriods.get(key(session.groupId, candidate.day)) ?? 0) - session.periods,
  )
  const courseKey = key(session.groupId, candidate.day, session.courseCode)
  const next = (state.groupDayCourses.get(courseKey) ?? 1) - 1
  if (next <= 0) state.groupDayCourses.delete(courseKey)
  else state.groupDayCourses.set(courseKey, next)
}

/** Depth-first search with dynamic MRV variable choice and heuristic value order. */
function search(state: SearchState): boolean {
  if (Date.now() > state.deadline) {
    state.timedOut = true
    return false
  }
  state.nodes += 1

  let chosenSession: EngineSession | null = null
  let chosenOptions: Candidate[] | null = null

  for (const session of state.input.sessions) {
    if (state.placements.has(session.id)) continue
    const staticOptions = state.staticCandidates.get(session.id) ?? []
    const options: Candidate[] = []
    for (const candidate of staticOptions) {
      if (isAvailable(state, session, candidate)) options.push(candidate)
    }
    if (options.length === 0) return false
    if (!chosenOptions || options.length < chosenOptions.length) {
      chosenSession = session
      chosenOptions = options
    }
  }

  if (!chosenSession || !chosenOptions) return true

  const ordered = [...chosenOptions].sort((a, b) => {
    const delta = scoreCandidate(state, chosenSession!, a) - scoreCandidate(state, chosenSession!, b)
    if (delta !== 0) return delta
    if (a.day !== b.day) return dayIndex(a.day) - dayIndex(b.day)
    if (a.startPeriod !== b.startPeriod) return a.startPeriod - b.startPeriod
    return a.roomId.localeCompare(b.roomId)
  })

  for (const candidate of ordered) {
    applyCandidate(state, chosenSession, candidate)
    if (search(state)) return true
    undoCandidate(state, chosenSession, candidate)
    if (state.timedOut) return false
  }

  return false
}

export function solveTimetable(input: EngineInput, options: EngineOptions = {}): SolveResult {
  const startedAt = Date.now()
  const state = createState(input, options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS)

  const impossible = computeStaticCandidates(state)
  if (impossible.length > 0) {
    const details = impossible
      .slice(0, 3)
      .map((session) => `${session.id} (${session.courseCode})`)
      .join(', ')
    return {
      status: 'INFEASIBLE',
      placements: [],
      unplacedSessionIds: impossible.map((session) => session.id),
      violations: [],
      metrics: { durationMs: Date.now() - startedAt, nodes: 0, placements: 0, softPenalty: 0 },
      message: `No legal room/time candidate exists for ${details}${
        impossible.length > 3 ? ` and ${impossible.length - 3} more` : ''
      }. Check capacity, room type and duration.`,
    }
  }

  const complete = search(state)
  const placements = [...state.placements.values()]
  const unplacedSessionIds = input.sessions
    .filter((session) => !state.placements.has(session.id))
    .map((session) => session.id)
  const durationMs = Date.now() - startedAt

  if (!complete) {
    return {
      status: state.timedOut ? 'TIMEOUT' : 'INFEASIBLE',
      placements,
      unplacedSessionIds,
      violations: [],
      metrics: { durationMs, nodes: state.nodes, placements: placements.length, softPenalty: 0 },
      message: state.timedOut
        ? `Search stopped at the time budget with ${unplacedSessionIds.length} sessions unplaced. A timeout is not proof of infeasibility.`
        : `No feasible assignment exists for the current constraints; ${unplacedSessionIds.length} sessions could not be placed.`,
    }
  }

  const violations = validatePlacements(input, placements)
  const softPenalty = computeSoftPenalty(input, placements)

  if (violations.length > 0) {
    return {
      status: 'INFEASIBLE',
      placements,
      unplacedSessionIds: [],
      violations,
      metrics: { durationMs, nodes: state.nodes, placements: placements.length, softPenalty },
      message: `The solver produced a complete schedule, but the independent validator rejected it with ${violations.length} violation${
        violations.length === 1 ? '' : 's'
      }. The result is not applied.`,
    }
  }

  return {
    status: 'FEASIBLE',
    placements,
    unplacedSessionIds: [],
    violations,
    metrics: { durationMs, nodes: state.nodes, placements: placements.length, softPenalty },
    message: `All ${placements.length} sessions placed and independently validated with 0 hard violations. Demo soft penalty ${softPenalty}.`,
  }
}

/**
 * Repairs a disruption by re-placing only the affected sessions and keeping
 * every other session exactly where it is. This is the "minimum moved sessions"
 * guarantee: unaffected sessions are never touched.
 */
export function repairTimetable(
  input: EngineInput,
  currentPlacements: Placement[],
  affectedSessionIds: string[],
  options: EngineOptions = {},
): RepairResult {
  const startedAt = Date.now()
  const state = createState(input, options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS)

  const emptyResult = (status: RepairResult['status'], message: string): RepairResult => ({
    status,
    affectedSessionIds,
    before: [],
    after: [],
    movedCount: 0,
    violations: [],
    metrics: { durationMs: Date.now() - startedAt, nodes: 0, placements: 0, softPenalty: 0 },
    message,
  })

  const affected = new Set(affectedSessionIds)
  const currentById = new Map(currentPlacements.map((placement) => [placement.sessionId, placement]))

  computeStaticCandidates(state)

  const missingFixed = input.sessions.filter(
    (session) => !affected.has(session.id) && !currentById.has(session.id),
  )
  if (missingFixed.length > 0) {
    return emptyResult(
      'INFEASIBLE',
      `Cannot repair: ${missingFixed.length} unaffected session(s) have no current placement to hold fixed.`,
    )
  }

  const impossibleAffected = input.sessions.filter(
    (session) => affected.has(session.id) && (state.staticCandidates.get(session.id)?.length ?? 0) === 0,
  )
  if (impossibleAffected.length > 0) {
    return emptyResult(
      'INFEASIBLE',
      `No legal alternative exists for ${impossibleAffected
        .map((session) => `${session.id} (${session.courseCode})`)
        .join(', ')}. Check room type, capacity and duration.`,
    )
  }

  // Hold every unaffected session exactly where it is.
  for (const session of input.sessions) {
    if (affected.has(session.id)) continue
    const placement = currentById.get(session.id)
    if (!placement) continue
    applyCandidate(state, session, {
      day: placement.day,
      startPeriod: placement.startPeriod,
      roomId: placement.roomId,
    })
  }

  const complete = search(state)
  const durationMs = Date.now() - startedAt

  const after = affectedSessionIds
    .map((sessionId) => state.placements.get(sessionId))
    .filter((placement): placement is Placement => placement !== undefined)
  const before = affectedSessionIds
    .map((sessionId) => currentById.get(sessionId))
    .filter((placement): placement is Placement => placement !== undefined)

  const unplacedAffected = affectedSessionIds.filter((sessionId) => !state.placements.has(sessionId))

  if (!complete || unplacedAffected.length > 0) {
    return {
      status: state.timedOut ? 'TIMEOUT' : 'INFEASIBLE',
      affectedSessionIds,
      before,
      after,
      movedCount: 0,
      violations: [],
      metrics: {
        durationMs,
        nodes: state.nodes,
        placements: after.length,
        softPenalty: 0,
      },
      message: state.timedOut
        ? `Search stopped at the time budget with ${unplacedAffected.length} affected session(s) unplaced. A timeout is not proof of infeasibility.`
        : `No valid repair found that keeps unaffected sessions fixed; ${unplacedAffected.length} affected session(s) could not be re-placed.`,
    }
  }

  const fixed = input.sessions
    .filter((session) => !affected.has(session.id))
    .map((session) => currentById.get(session.id))
    .filter((placement): placement is Placement => placement !== undefined)

  const merged = [...fixed, ...after]
  const violations = validatePlacements(input, merged)
  const softPenalty = computeSoftPenalty(input, merged)

  const movedCount = after.filter((placement) => {
    const original = currentById.get(placement.sessionId)
    return (
      original === undefined ||
      original.day !== placement.day ||
      original.startPeriod !== placement.startPeriod ||
      original.roomId !== placement.roomId
    )
  }).length

  if (violations.length > 0) {
    return {
      status: 'INFEASIBLE',
      affectedSessionIds,
      before,
      after,
      movedCount,
      violations,
      metrics: { durationMs, nodes: state.nodes, placements: after.length, softPenalty },
      message: `The repaired timetable still fails ${violations.length} hard check${
        violations.length === 1 ? '' : 's'
      }; it will not be offered for approval.`,
    }
  }

  return {
    status: 'FEASIBLE',
    affectedSessionIds,
    before,
    after,
    movedCount,
    violations,
    metrics: { durationMs, nodes: state.nodes, placements: after.length, softPenalty },
    message: `${affectedSessionIds.length} affected session(s) re-placed, ${movedCount} actually moved, 0 hard violations. Unaffected sessions were left untouched.`,
  }
}

/** Small helper used by the UI when describing a placement. */
export function describePlacement(input: EngineInput, placement: Placement): string {
  const room = input.rooms.find((item) => item.id === placement.roomId)
  return `${room?.name ?? placement.roomId} · ${placement.day} ${periodRangeLabel(
    placement.startPeriod,
    placement.periods,
  )}`
}
