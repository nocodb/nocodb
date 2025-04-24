import { FormBuilderInputType, IntegrationsType } from 'nocodb-sdk';

export default [
  {
    type: FormBuilderInputType.Input,
    label: 'Sync name',
    width: 100,
    model: 'title',
    placeholder: 'Sync name',
    category: 'General',
    validators: [
      {
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Auth Provider',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationsType.Auth,
      sub_type: 'rest',
    },
    validators: [
      {
        type: 'required',
        message: 'Auth Provider is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Endpoint Path',
    width: 100,
    model: 'config.url',
    placeholder: '/api/v1/resources',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Endpoint path is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Data Path (JSON)',
    width: 100,
    model: 'config.dataPath',
    placeholder: 'e.g. data.items',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Data path is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    selectMode: 'multipleWithInput',
    label: 'Primary Key Path (JSON)',
    width: 100,
    model: 'config.system.primaryKey',
    placeholder: 'e.g. id or data.id',
    category: 'System Fields',
    validators: [
      {
        type: 'required',
        message: 'Primary key path is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Created At Path (JSON)',
    width: 48,
    model: 'config.system.createdAt',
    category: 'System Fields',
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'System Fields',
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Updated At Path (JSON)',
    width: 48,
    model: 'config.system.updatedAt',
    category: 'System Fields',
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Pagination Mode',
    width: 100,
    model: 'config.pagination.mode',
    category: 'Pagination',
    options: [
      { value: 'none', label: 'None' },
      { value: 'next', label: 'Next URL in response' },
      { value: 'offset', label: 'Offset-based' },
      { value: 'page', label: 'Page-based' },
      { value: 'cursor', label: 'Cursor-based' },
    ],
  },
  // NEXT mode
  {
    type: FormBuilderInputType.Input,
    label: 'Next URL Path (JSON)',
    width: 100,
    model: 'config.pagination.nextPath',
    placeholder: 'e.g. meta.next',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'next',
    },
  },
  // OFFSET mode
  {
    type: FormBuilderInputType.Input,
    label: 'Offset Param',
    width: 48,
    model: 'config.pagination.offsetParam',
    placeholder: 'e.g. offset',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'offset',
    },
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'offset',
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Limit Param',
    width: 48,
    model: 'config.pagination.limitParam',
    placeholder: 'e.g. limit',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'offset',
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Page Size',
    width: 100,
    model: 'config.pagination.limit',
    placeholder: 'e.g. 100',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'offset',
    },
  },
  // PAGE mode
  {
    type: FormBuilderInputType.Input,
    label: 'Page Param',
    width: 48,
    model: 'config.pagination.pageParam',
    placeholder: 'e.g. page',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'page',
    },
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'page',
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Start Page',
    width: 48,
    model: 'config.pagination.startPage',
    placeholder: 'e.g. 1',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'page',
    },
  },
  // CURSOR mode
  {
    type: FormBuilderInputType.Input,
    label: 'Cursor Param',
    width: 48,
    model: 'config.pagination.cursorParam',
    placeholder: 'e.g. after',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'cursor',
    },
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'cursor',
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Cursor Path (JSON)',
    width: 48,
    model: 'config.pagination.cursorPath',
    placeholder: 'e.g. meta.next_cursor',
    category: 'Pagination',
    condition: {
      model: 'config.pagination.mode',
      value: 'cursor',
    },
  },
];
