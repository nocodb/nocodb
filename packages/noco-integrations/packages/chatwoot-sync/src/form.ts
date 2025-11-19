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
    width: 100,
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
    label: 'Chatwoot Connection',
    width: 100,
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
    width: 50,
    model: 'config.inboxId',
    placeholder: 'e.g., 123',
    category: 'Options',
  },
  {
    type: FormBuilderInputType.Space,
    width: 50,
    category: 'Options',
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include resolved conversations',
    width: 50,
    model: 'config.includeResolved',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;
