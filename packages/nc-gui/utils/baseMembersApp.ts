import { ProjectRoles } from 'nocodb-sdk'

// The app store acts on the active base only, so any other page would show app controls that fail.
export function appOnBaseMembersList<T>(
  app: T | null,
  { isAdminPanel, pageBaseId, activeBaseId }: { isAdminPanel: boolean; pageBaseId?: string; activeBaseId?: string },
): T | null {
  return isAdminPanel || pageBaseId !== activeBaseId ? null : app
}

// Stored app-team rows outlive project access, so a No access member can still open the app.
export function appTeamsKeptOnNoAccess(
  app: { teams: { id: string; title: string }[] } | null,
  member: { app_teams?: { id: string }[] },
  role?: string | null,
): string[] {
  if (!app || role !== ProjectRoles.NO_ACCESS) return []
  const ids = new Set((member.app_teams ?? []).map((team) => team.id))
  return app.teams.filter((team) => ids.has(team.id)).map((team) => team.title)
}
