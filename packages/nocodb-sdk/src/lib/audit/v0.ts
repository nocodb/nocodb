enum AuditOperationTypes {
  COMMENT = 'COMMENT',
  DATA = 'DATA',
  PROJECT = 'PROJECT',
  VIRTUAL_RELATION = 'VIRTUAL_RELATION',
  RELATION = 'RELATION',
  TABLE_VIEW = 'TABLE_VIEW',
  TABLE = 'TABLE',
  VIEW = 'VIEW',
  META = 'META',
  TABLE_COLUMN = 'TABLE_COLUMN',
  WEBHOOKS = 'WEBHOOKS',
  AUTHENTICATION = 'AUTHENTICATION',
  ORG_USER = 'ORG_USER',
}

enum AuditOperationSubTypes {
  INSERT = 'INSERT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  BULK_INSERT = 'BULK_INSERT',
  BULK_UPDATE = 'BULK_UPDATE',
  BULK_DELETE = 'BULK_DELETE',
  LINK_RECORD = 'LINK_RECORD',
  UNLINK_RECORD = 'UNLINK_RECORD',
  RENAME = 'RENAME',
  IMPORT_FROM_ZIP = 'IMPORT_FROM_ZIP',
  EXPORT_TO_FS = 'EXPORT_TO_FS',
  EXPORT_TO_ZIP = 'EXPORT_TO_ZIP',
  SIGNIN = 'SIGNIN',
  SIGNUP = 'SIGNUP',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_FORGOT = 'PASSWORD_FORGOT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  ROLES_MANAGEMENT = 'ROLES_MANAGEMENT',
  INVITE = 'INVITE',
  RESEND_INVITE = 'RESEND_INVITE',
}

const auditOperationTypeLabels = {
  [AuditOperationTypes.COMMENT]: 'Comment',
  [AuditOperationTypes.DATA]: 'Data',
  [AuditOperationTypes.PROJECT]: 'Project',
  [AuditOperationTypes.VIRTUAL_RELATION]: 'Virtual Relation',
  [AuditOperationTypes.RELATION]: 'Relation',
  [AuditOperationTypes.TABLE_VIEW]: 'Table View',
  [AuditOperationTypes.TABLE]: 'Table',
  [AuditOperationTypes.VIEW]: 'View',
  [AuditOperationTypes.META]: 'Meta',
  [AuditOperationTypes.WEBHOOKS]: 'Webhooks',
  [AuditOperationTypes.AUTHENTICATION]: 'Authentication',
  [AuditOperationTypes.TABLE_COLUMN]: 'Table Column',
  [AuditOperationTypes.ORG_USER]: 'Org User',
};

const auditOperationSubTypeLabels = {
  [AuditOperationSubTypes.UPDATE]: 'Update',
  [AuditOperationSubTypes.INSERT]: 'Insert',
  [AuditOperationSubTypes.DELETE]: 'Delete',
  [AuditOperationSubTypes.BULK_INSERT]: 'Bulk Insert',
  [AuditOperationSubTypes.BULK_UPDATE]: 'Bulk Update',
  [AuditOperationSubTypes.BULK_DELETE]: 'Bulk Delete',
  [AuditOperationSubTypes.LINK_RECORD]: 'Link Record',
  [AuditOperationSubTypes.UNLINK_RECORD]: 'Unlink Record',
  [AuditOperationSubTypes.CREATE]: 'Create',
  [AuditOperationSubTypes.RENAME]: 'Rename',
  [AuditOperationSubTypes.IMPORT_FROM_ZIP]: 'Import From Zip',
  [AuditOperationSubTypes.EXPORT_TO_FS]: 'Export To FS',
  [AuditOperationSubTypes.EXPORT_TO_ZIP]: 'Export To Zip',
  [AuditOperationSubTypes.SIGNIN]: 'Signin',
  [AuditOperationSubTypes.SIGNUP]: 'Signup',
  [AuditOperationSubTypes.PASSWORD_RESET]: 'Password Reset',
  [AuditOperationSubTypes.PASSWORD_FORGOT]: 'Password Forgot',
  [AuditOperationSubTypes.PASSWORD_CHANGE]: 'Password Change',
  [AuditOperationSubTypes.EMAIL_VERIFICATION]: 'Email Verification',
  [AuditOperationSubTypes.ROLES_MANAGEMENT]: 'Roles Management',
  [AuditOperationSubTypes.INVITE]: 'Invite',
  [AuditOperationSubTypes.RESEND_INVITE]: 'Resend Invite',
};

interface AuditV0 {
  id: string;
  user: string;
  ip: string;
  fk_workspace_id: string | null;
  base_id: string | null;
  source_id: string | null;
  fk_model_id: string | null;
  row_id: string | null;
  op_type: AuditOperationTypes;
  op_sub_type: AuditOperationSubTypes;
  description: string | null;
  details: string | null;
  created_at: string;
  updated_at: string;
}

export { AuditV0, AuditOperationTypes, AuditOperationSubTypes, auditOperationTypeLabels, auditOperationSubTypeLabels };
