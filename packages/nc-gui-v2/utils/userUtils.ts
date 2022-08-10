import { ProjectRole } from '~/lib/enums'

export const projectRoleTagColors = {
  [ProjectRole.Creator]: '#d0f1fd',
  [ProjectRole.Editor]: '#c2f5e8',
  [ProjectRole.Commenter]: '#ffdaf6',
  [ProjectRole.Viewer]: '#ffdce5',
}
