import type { TeamV3V3Type } from 'nocodb-sdk'

export const transformToTeamObject = (wsOrBaseTeamInfo: Record<string, any>, team?: TeamV3V3Type) => {
  const newObj: Record<string, any> = {}

  Object.keys(wsOrBaseTeamInfo).forEach((key) => {
    if (key.startsWith('team_')) {
      newObj[key.replace('team_', '')] = wsOrBaseTeamInfo[key]
    } else {
      newObj[key] = wsOrBaseTeamInfo[key]
    }
  })

  if (team) {
    newObj.is_member = team.is_member
    newObj.members_count = team.members_count
    newObj.managers_count = team.managers_count
    newObj.managers = team.managers
  }

  return newObj
}
