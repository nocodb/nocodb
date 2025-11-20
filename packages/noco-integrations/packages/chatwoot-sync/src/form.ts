import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    span: 24,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Chatwoot connection',
    span: 24,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'chatwoot',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Chatwoot connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Inbox ID (optional)',
    span: 12,
    model: 'config.inboxId',
    placeholder: 'e.g., 123',
    category: 'Options',
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include resolved conversations',
    span: 12,
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    model: 'config.includeResolved',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;
