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
import { RecordDeletedTriggerNode } from './nodes/record-deleted-trigger';
import { FormSubmittedTriggerNode } from './nodes/form-submitted-trigger';
import { RecordEntersViewTriggerNode } from './nodes/record-enters-view-trigger';
import { RecordMatchesConditionTriggerNode } from './nodes/record-matches-condition-trigger';
import { RunScriptNode } from './nodes/run-script';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_insert',
    wrapper: RecordCreatedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Created Trigger',
      order: 1,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_update',
    wrapper: RecordUpdatedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Updated Trigger',
      order: 2,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_delete',
    wrapper: RecordDeletedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Deleted Trigger',
      order: 3,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.form_submitted',
    wrapper: FormSubmittedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Form Submitted Trigger',
      order: 4,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.record_enters_view',
    wrapper: RecordEntersViewTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Enters View Trigger',
      order: 5,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.record_matches_condition',
    wrapper: RecordMatchesConditionTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Matches Condition Trigger',
      order: 6,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.create_record',
    wrapper: CreateRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Create Record',
      order: 7,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.update_record',
    wrapper: UpdateRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Update Record',
      order: 8,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.find_record',
    wrapper: FindRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Find Record',
      order: 9,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.list_records',
    wrapper: ListRecordsNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - List Records',
      order: 10,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.delete_record',
    wrapper: DeleteRecordNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Delete Record',
      order: 11,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.run_script',
    wrapper: RunScriptNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Run Script',
      order: 12,
    },
  },
];

export default entries;
