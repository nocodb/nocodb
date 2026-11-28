import { ProjectRoles } from 'nocodb-sdk'

const EDITOR_AND_ABOVE: string[] = [ProjectRoles.OWNER, ProjectRoles.CREATOR, ProjectRoles.EDITOR]

interface RoleChangeInput {
  isV2: boolean
  editorPrice?: string
  hasApp: boolean
  role: string
  seatType?: string
  appTeams?: { id: string; source: string; via_team?: { title: string } }[] | null
}

// Editor+ is the only seat outcome known client-side; anything else would be a guess.
export function planBaseMemberRoleChange({ isV2, editorPrice, hasApp, role, seatType, appTeams }: RoleChangeInput) {
  const becomesEditor = isV2 && !!editorPrice && !!seatType && seatType !== 'full' && EDITOR_AND_ABOVE.includes(role)

  const losingAppTeams = role === ProjectRoles.NO_ACCESS && hasApp ? appTeams ?? [] : []

  return {
    becomesEditor,
    hasExplicitAppTeams: losingAppTeams.some((team) => team.source === 'explicit'),
    viaTeams: [...new Set(losingAppTeams.filter((team) => team.source === 'team').map((team) => team.via_team?.title ?? ''))],
  }
}

// The role change goes first; a failed one leaves the app access alone.
export async function changeRoleThenRemoveFromApp(changeRole: () => Promise<boolean>, removeFromApp: () => Promise<unknown>) {
  if (!(await changeRole())) return false

  await removeFromApp()

  return true
}
