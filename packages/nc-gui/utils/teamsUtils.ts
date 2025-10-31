export const transformToTeamObject = (wsOrBaseTeamInfo: Record<string, any>) => {
  const newObj: Record<string, any> = {}

  Object.keys(wsOrBaseTeamInfo).forEach((key) => {
    if (key.startsWith('team_')) {
      newObj[key.replace('team_', '')] = wsOrBaseTeamInfo[key]
    } else {
      newObj[key] = wsOrBaseTeamInfo[key]
    }
  })

  return newObj
}
