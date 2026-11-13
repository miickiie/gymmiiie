export const AI_WORKOUT_MODEL = '@cf/google/gemma-4-26b-a4b-it' as const
export const AI_WORKOUT_LIMITS = {
  candidates: 32, exercises: 8, bodyBytes: 64 * 1024, completionTokens: 1500,
  serverTimeout: 30_000, clientTimeout: 35_000, minuteAttempts: 5, dailyAttempts: 20,
  name: 160, reason: 280, sets: 12, restSeconds: 600,
} as const

export const AI_MUSCLES = ['chest', 'shoulders', 'biceps', 'abdomen', 'obliques', 'quads', 'forearm', 'trapezius', 'back', 'lowerback', 'triceps', 'glutes', 'hamstrings', 'calves'] as const
export type AiMuscle = typeof AI_MUSCLES[number]
export type AiWorkoutMode = 'suggest' | 'routine'

export interface AiWorkoutCandidate {
  id: string
  name: string
  primary: AiMuscle
  secondary: AiMuscle[]
  suggestionGroup: string
  favorite: boolean
  history: { hasWorkingSets: boolean; lastTrainedAt: number | null; latestWorkingSets: number; workingSets30Days: number }
}

export interface AiWorkoutRequest {
  mode: AiWorkoutMode
  expectedAccountId: string
  selectedMuscles: AiMuscle[]
  language: 'en' | 'th'
  profile: { sex: 'male' | 'female' | 'other'; age: number; height: number; weight: number; activity: number }
  candidates: AiWorkoutCandidate[]
  baselineIds: string[]
}

export interface AiWorkoutItem { exerciseId: string; reason: string; sets?: number; restSeconds?: number }
export interface AiWorkoutPlan { mode: AiWorkoutMode; name?: string; items: AiWorkoutItem[] }
export type AiWorkoutErrorCode = 'AI_DISABLED' | 'AI_LIMIT' | 'AI_QUOTA' | 'AI_BUSY' | 'AI_TIMEOUT' | 'AI_INVALID_RESPONSE' | 'AI_UNAVAILABLE' | 'AI_ACCOUNT_CHANGED'

export class AiWorkoutValidationError extends Error {
  constructor() { super('Invalid workout plan'); this.name = 'AiWorkoutValidationError' }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw new AiWorkoutValidationError()
  return value
}

function text(value: unknown, maximum: number = AI_WORKOUT_LIMITS.name): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new AiWorkoutValidationError()
  return value.trim()
}

function number(value: unknown, maximum = Number.MAX_SAFE_INTEGER, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new AiWorkoutValidationError()
  return value
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new AiWorkoutValidationError()
  return value
}

function muscle(value: unknown): AiMuscle {
  const found = AI_MUSCLES.find(item => item === value)
  if (!found) throw new AiWorkoutValidationError()
  return found
}

function unique<T>(values: T[]): T[] {
  if (new Set(values).size !== values.length) throw new AiWorkoutValidationError()
  return values
}

export function parseAiWorkoutRequest(value: unknown): AiWorkoutRequest {
  const input = record(value, ['mode', 'expectedAccountId', 'selectedMuscles', 'language', 'profile', 'candidates', 'baselineIds'])
  if (input.mode !== 'suggest' && input.mode !== 'routine') throw new AiWorkoutValidationError()
  if (input.language !== 'en' && input.language !== 'th') throw new AiWorkoutValidationError()
  const profile = record(input.profile, ['sex', 'age', 'height', 'weight', 'activity'])
  if (profile.sex !== 'male' && profile.sex !== 'female' && profile.sex !== 'other') throw new AiWorkoutValidationError()
  const selectedMuscles = unique(array(input.selectedMuscles, AI_MUSCLES.length).map(muscle))
  if (!selectedMuscles.length) throw new AiWorkoutValidationError()
  const candidates = array(input.candidates, AI_WORKOUT_LIMITS.candidates).map(value => {
    const candidate = record(value, ['id', 'name', 'primary', 'secondary', 'suggestionGroup', 'favorite', 'history'])
    const history = record(candidate.history, ['hasWorkingSets', 'lastTrainedAt', 'latestWorkingSets', 'workingSets30Days'])
    if (typeof candidate.favorite !== 'boolean' || typeof history.hasWorkingSets !== 'boolean') throw new AiWorkoutValidationError()
    const result: AiWorkoutCandidate = {
      id: text(candidate.id), name: text(candidate.name), primary: muscle(candidate.primary),
      secondary: unique(array(candidate.secondary, AI_MUSCLES.length).map(muscle)), suggestionGroup: text(candidate.suggestionGroup),
      favorite: candidate.favorite,
      history: {
        hasWorkingSets: history.hasWorkingSets,
        lastTrainedAt: history.lastTrainedAt === null ? null : number(history.lastTrainedAt),
        latestWorkingSets: number(history.latestWorkingSets), workingSets30Days: number(history.workingSets30Days),
      },
    }
    if (![result.primary, ...result.secondary].some(item => selectedMuscles.includes(item))) throw new AiWorkoutValidationError()
    return result
  })
  unique(candidates.map(item => item.id))
  const baselineIds = unique(array(input.baselineIds, AI_WORKOUT_LIMITS.exercises).map(value => text(value)))
  if (!candidates.length || baselineIds.some(id => !candidates.some(item => item.id === id))) throw new AiWorkoutValidationError()
  if (input.mode === 'suggest' && (!baselineIds.length || baselineIds.length !== candidates.length)) throw new AiWorkoutValidationError()
  return {
    mode: input.mode, expectedAccountId: text(input.expectedAccountId), selectedMuscles, language: input.language,
    profile: {
      sex: profile.sex, age: number(profile.age, undefined, Number.MIN_VALUE), height: number(profile.height, undefined, Number.MIN_VALUE),
      weight: number(profile.weight, undefined, Number.MIN_VALUE), activity: number(profile.activity, undefined, Number.MIN_VALUE),
    }, candidates, baselineIds,
  }
}

export function parseAiWorkoutOutput(value: unknown, request: AiWorkoutRequest): AiWorkoutPlan {
  const output = record(value, request.mode === 'routine' ? ['name', 'items'] : ['items'])
  const items = array(output.items, AI_WORKOUT_LIMITS.exercises).map(value => {
    const item = record(value, request.mode === 'routine' ? ['exerciseId', 'reason', 'sets', 'restSeconds'] : ['exerciseId', 'reason'])
    const result: AiWorkoutItem = { exerciseId: text(item.exerciseId), reason: text(item.reason, AI_WORKOUT_LIMITS.reason) }
    if (!request.candidates.some(candidate => candidate.id === result.exerciseId)) throw new AiWorkoutValidationError()
    if (request.mode === 'routine') {
      result.sets = number(item.sets, AI_WORKOUT_LIMITS.sets, 1)
      result.restSeconds = number(item.restSeconds, AI_WORKOUT_LIMITS.restSeconds)
      if (!Number.isInteger(result.sets) || result.restSeconds % 15 !== 0) throw new AiWorkoutValidationError()
    }
    return result
  })
  unique(items.map(item => item.exerciseId))
  if (!items.length) throw new AiWorkoutValidationError()
  if (request.mode === 'suggest' && (items.length !== request.baselineIds.length || request.baselineIds.some(id => !items.some(item => item.exerciseId === id)))) throw new AiWorkoutValidationError()
  if (request.mode === 'routine') {
    const groups = items.map(item => request.candidates.find(candidate => candidate.id === item.exerciseId)?.suggestionGroup)
    unique(groups)
  }
  return { mode: request.mode, ...(request.mode === 'routine' ? { name: text(output.name) } : {}), items }
}
