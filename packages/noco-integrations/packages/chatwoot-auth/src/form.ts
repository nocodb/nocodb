import {
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

export const form: FormDefinition = [
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
    type: FormBuilderInputType.Input,
    label: 'Chatwoot URL',
    width: 100,
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
    width: 100,
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
    label: 'API Access Token',
    width: 100,
    model: 'config.api_token',
    category: 'Authentication',
    placeholder: 'Enter your API Access Token',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API Access Token is required',
      },
    ],
  },
];
