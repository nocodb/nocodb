import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  AuthType,
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
    type: FormBuilderInputType.Select,
    label: 'Auth type',
    span: 12,
    model: 'config.type',
    category: 'Authentication',
    placeholder: 'Select auth type',
    defaultValue: AuthType.ApiKey,
    options: [
      {
        label: 'API credentials',
        value: AuthType.ApiKey,
      },
    ],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Auth type is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Account SID',
    span: 24,
    model: 'config.accountSid',
    category: 'Authentication',
    placeholder: 'Enter your Twilio Account SID (ACxxxxxxx)',
    helpText: 'Get your Account SID from https://console.twilio.com',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Account SID is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  {
    type: FormBuilderInputType.Password,
    label: 'Auth Token',
    span: 24,
    model: 'config.authToken',
    category: 'Authentication',
    placeholder: 'Enter your Twilio Auth Token',
    helpText: 'Get your Auth Token from https://console.twilio.com',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Auth Token is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
];
