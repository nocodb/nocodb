import { ProjectRole } from '~/lib/enums'

export const projectRoleTagColors = {
  [ProjectRole.Owner]: '#cfdffe',
  [ProjectRole.Editor]: '#c2f5e8',
  [ProjectRole.User]: '#4caf50',
  [ProjectRole.Guest]: '#9e9e9e',
}
