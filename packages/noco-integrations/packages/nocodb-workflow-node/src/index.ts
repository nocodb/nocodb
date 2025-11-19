import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { RecordCreatedTriggerNode } from './nodes/record-created-trigger';
import { RecordUpdatedTriggerNode } from './nodes/record-updated-trigger';
import { CreateRecordNode } from './nodes/create-record';
import { UpdateRecordNode } from './nodes/update-record';
import { FindRecordNode } from './nodes/find-record';
import { ListRecordsNode } from './nodes/list-records';
import { DeleteRecordNode } from './nodes/delete-record';

export * from './manifest';
export * from './nodes/record-created-trigger';
export * from './nodes/record-updated-trigger';
export * from './nodes/create-record';
export * from './nodes/update-record';
export * from './nodes/find-record';
export * from './nodes/list-records';
export * from './nodes/delete-record';

// Export NocoDB node as an integration entry
export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_insert',
    wrapper: RecordCreatedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Created Trigger',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_update',
    wrapper: RecordUpdatedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Updated Trigger',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.create_record',
    wrapper: CreateRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Create Record',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.update_record',
    wrapper: UpdateRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Update Record',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.find_record',
    wrapper: FindRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Find Record',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.list_records',
    wrapper: ListRecordsNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - List Records',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.delete_record',
    wrapper: DeleteRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Delete Record',
    },
  },
];

export default entries;
