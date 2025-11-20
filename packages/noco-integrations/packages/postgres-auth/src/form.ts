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
    label: 'Host',
    span: 24,
    model: 'config.host',
    category: 'Authentication',
    placeholder: 'Enter your PostgreSQL host',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Host is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Port',
    span: 24,
    model: 'config.port',
    category: 'Authentication',
    placeholder: '5432',
    defaultValue: '5432',
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Username',
    span: 24,
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
    span: 24,
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
  {
    type: FormBuilderInputType.Input,
    label: 'Database',
    span: 24,
    model: 'config.database',
    category: 'Authentication',
    placeholder: 'Enter your database name',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Database name is required',
      },
    ],
  },
];
