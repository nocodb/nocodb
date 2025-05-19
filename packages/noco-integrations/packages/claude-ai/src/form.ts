import {
  FormBuilderInputType,
  type FormDefinition,
} from '@noco-integrations/core';

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
        type: 'required' as const,
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 100,
    model: 'config.apiKey',
    placeholder: 'API Key',
    category: 'Credentials',
    validators: [
      {
        type: 'required' as const,
        message: 'API Key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models',
    width: 100,
    model: 'config.models',
    placeholder: 'Allowed models',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    options: [
      { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      { value: 'claude-2.1', label: 'Claude 2.1' },
      { value: 'claude-2.0', label: 'Claude 2.0' },
      { value: 'claude-instant-1.2', label: 'Claude Instant 1.2' }
    ],
    defaultValue: ['claude-3-5-sonnet-20240620'],
    validators: [
      {
        type: 'required' as const,
        message: 'At least one model is required',
      },
    ],
  },
]; 