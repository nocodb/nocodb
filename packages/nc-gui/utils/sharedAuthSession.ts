import type { JwtPayload } from 'jwt-decode'

export const resolveStoredSessionUser = <T extends JwtPayload & { id?: string; email?: string }>(
  payload: T | null | undefined,
  nowMs: number,
): T | null => {
  if (!payload?.id || !payload.email || !payload.exp || payload.exp <= nowMs / 1000) {
    return null
  }

  return payload
}
