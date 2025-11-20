import {
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

export const form: FormDefinition = [
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
    type: FormBuilderInputType.Input,
    label: 'Chatwoot URL',
    span: 24,
    model: 'config.chatwoot_url',
    defaultValue: 'https://app.chatwoot.com',
    category: 'Authentication',
    placeholder: 'https://app.chatwoot.com',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Chatwoot URL is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Account ID',
    span: 24,
    model: 'config.account_id',
    category: 'Authentication',
    placeholder: 'Enter your Chatwoot Account ID',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Account ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API access token',
    span: 24,
    model: 'config.api_token',
    category: 'Authentication',
    placeholder: 'Enter your API access token',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API access token is required',
      },
    ],
  },
];
