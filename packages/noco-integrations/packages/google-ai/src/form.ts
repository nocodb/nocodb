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
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' },
      { value: 'gemini-1.0-ultra', label: 'Gemini 1.0 Ultra' },
    ],
    defaultValue: ['gemini-1.5-pro'],
    validators: [
      {
        type: 'required' as const,
        message: 'At least one model is required',
      },
    ],
  },
]; 