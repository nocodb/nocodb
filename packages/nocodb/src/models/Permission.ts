import type {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default class Permission {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  created_by: string;
  enforce_for_form: boolean;
  enforce_for_automation: boolean;
  granted_type: PermissionGrantedType;
  granted_role: PermissionRole;

  subjects?: {
    type: 'user' | 'group';
    id: string;
  }[];

  constructor(permission: Permission) {
    Object.assign(this, permission);
  }
  public static async list(
    context: NcContext,
    baseId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<Permission[]> {
    return [];
  }
}
