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
    label: 'Clickhouse instance URL',
    span: 24,
    model: 'config.url',
    category: 'Authentication',
    placeholder: 'Enter your Clickhouse instance URL',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Clickhouse instance URL is required',
      },
    ],
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
];
