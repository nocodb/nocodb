import { OrgUserRoles } from 'nocodb-sdk'
import { ProjectRole } from '~/lib/enums'

export const projectRoleTagColors = {
  [ProjectRole.Owner]: '#cfdffe',
  [ProjectRole.Creator]: '#d0f1fd',
  [ProjectRole.Editor]: '#c2f5e8',
  [ProjectRole.Commenter]: '#ffdaf6',
  [ProjectRole.Viewer]: '#ffdce5',
  [OrgUserRoles.SUPER_ADMIN]: '#f5d7cb',
}

export const projectRoles = [ProjectRole.Creator, ProjectRole.Editor, ProjectRole.Commenter, ProjectRole.Viewer]
