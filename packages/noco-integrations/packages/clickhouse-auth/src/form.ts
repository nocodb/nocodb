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
    label: 'Clickhouse Instance URL',
    width: 100,
    model: 'config.url',
    category: 'Authentication',
    placeholder: 'Enter your Clickhouse Instance URL',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Clickhouse Instance URL is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Username',
    width: 100,
    model: 'config.username',
    category: 'Authentication',
    placeholder: 'Enter your username',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Username is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Password,
    label: 'Password',
    width: 100,
    model: 'config.password',
    category: 'Authentication',
    placeholder: 'Enter your password',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Password is required',
      },
    ],
  },
];
