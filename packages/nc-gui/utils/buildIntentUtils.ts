import { type BuildScope, isBuildScope } from 'nocodb-sdk'

/**
 * Pure helpers for the landing-page build hand-off. Kept free of Vue and of storage
 * access so they are directly testable — see `composables/useBuildIntent.ts` for the
 * stateful half and for why the hand-off cannot be read straight off the route.
 */
export interface BuildIntent {
  prompt: string
  autoBuild: boolean
  /**
   * What the landing page's target picker asked for. Always a valid scope — an
   * absent or unrecognized `buildScope` normalises to 'app', so a hand-off link
   * minted before scopes existed still gets the full build it expects.
   */
  scope: BuildScope
  /** Epoch ms of capture; drives the TTL. */
  capturedAt: number
}

export const BUILD_INTENT_KEY = 'nc-build-intent'

export const BUILD_INTENT_TTL_MS = 30 * 60 * 1000

/** Mirrors the landing page's own cap. */
export const BUILD_INTENT_PROMPT_MAX_LENGTH = 2000

/** Query param carrying the picked build target. */
export const BUILD_SCOPE_PARAM = 'buildScope'

const toScope = (raw: unknown): BuildScope => (isBuildScope(raw) ? raw : 'app')

/**
 * Parse a hand-off query string. Returns null unless the search carries both a
 * non-empty `basePrompt` and a truthy `autoBuild` — a plain `?basePrompt=` is an
 * existing in-app deep link, which must keep its prefill-and-wait behaviour.
 */
export const parseBuildIntentFromSearch = (search: string, now: number): BuildIntent | null => {
  const params = new URLSearchParams(search)

  const autoBuildParam = params.get('autoBuild')
  if (autoBuildParam !== '1' && autoBuildParam !== 'true') return null

  const prompt = (params.get('basePrompt') ?? '').trim()
  if (!prompt) return null

  return {
    prompt: prompt.slice(0, BUILD_INTENT_PROMPT_MAX_LENGTH),
    autoBuild: true,
    scope: toScope(params.get(BUILD_SCOPE_PARAM)),
    capturedAt: now,
  }
}

/** An intent older than the TTL is treated as absent. */
export const isBuildIntentFresh = (intent: BuildIntent | null, now: number): boolean => {
  if (!intent?.prompt) return false
  if (typeof intent.capturedAt !== 'number') return false

  const age = now - intent.capturedAt

  // A clock that moved backwards (timezone/NTP correction) must not resurrect a stale
  // intent either — only a non-negative age inside the window counts as fresh.
  return age >= 0 && age <= BUILD_INTENT_TTL_MS
}

/**
 * Normalise whatever was in storage. Returns null for corrupt, malformed or expired
 * payloads so callers only ever see a usable intent.
 */
export const parseStoredBuildIntent = (raw: string | null, now: number): BuildIntent | null => {
  if (!raw) return null

  let parsed: Partial<BuildIntent> | null = null
  try {
    parsed = JSON.parse(raw) as Partial<BuildIntent>
  } catch {
    return null
  }

  if (!parsed || typeof parsed.prompt !== 'string') return null

  const intent: BuildIntent = {
    prompt: parsed.prompt.trim().slice(0, BUILD_INTENT_PROMPT_MAX_LENGTH),
    autoBuild: !!parsed.autoBuild,
    // A stash written before scopes existed has none; it means the full build.
    scope: toScope(parsed.scope),
    capturedAt: typeof parsed.capturedAt === 'number' ? parsed.capturedAt : 0,
  }

  return isBuildIntentFresh(intent, now) ? intent : null
}
