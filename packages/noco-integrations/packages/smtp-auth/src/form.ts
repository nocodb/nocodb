import {
  AuthType,
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

export const form: FormDefinition = [
  // ── General ────────────────────────────────────────────────────────────
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    model: 'title',
    span: 24,
    category: 'General',
    placeholder: 'e.g. SendGrid Production',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Integration name is required',
      },
    ],
  },

  // ── Connection ─────────────────────────────────────────────────────────
  {
    type: FormBuilderInputType.Input,
    label: 'SMTP host',
    model: 'config.host',
    span: 16,
    category: 'Connection',
    placeholder: 'smtp.sendgrid.net',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Host is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Number,
    label: 'Port',
    model: 'config.port',
    span: 8,
    category: 'Connection',
    defaultValue: 587,
    placeholder: '587',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Port is required',
      },
      {
        type: FormBuilderValidatorType.MinValue,
        value: 1,
        message: 'Port must be between 1 and 65535',
      },
      {
        type: FormBuilderValidatorType.MaxValue,
        value: 65535,
        message: 'Port must be between 1 and 65535',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Encryption',
    model: 'config.encryption',
    span: [24, 12],
    category: 'Connection',
    defaultValue: 'tls',
    options: [
      { label: 'STARTTLS (recommended, port 587)', value: 'tls' },
      { label: 'SSL/TLS (port 465)', value: 'ssl' },
      { label: 'None (port 25)', value: 'none' },
    ],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Encryption is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Allow self-signed certificates',
    model: 'config.allowSelfSigned',
    span: 24,
    category: 'Connection',
    defaultValue: false,
    helpText:
      'Enable only for private or development SMTP servers with untrusted certificates',
  },

  // ── Authentication ─────────────────────────────────────────────────────
  {
    type: FormBuilderInputType.Select,
    label: 'Auth type',
    model: 'config.type',
    span: 24,
    category: 'Authentication',
    defaultValue: AuthType.ApiKey,
    options: [{ label: 'Username & Password', value: AuthType.ApiKey }],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Auth type is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Username',
    model: 'config.username',
    span: [24, 12],
    category: 'Authentication',
    placeholder: 'apikey',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Username is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Password,
    label: 'Password / API key',
    model: 'config.password',
    span: [24, 12],
    category: 'Authentication',
    placeholder: '••••••••',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Password is required',
      },
    ],
  },

  // ── Sender defaults ────────────────────────────────────────────────────
  {
    type: FormBuilderInputType.Input,
    label: 'From email',
    model: 'config.fromEmail',
    span: [24, 12],
    category: 'Sender',
    placeholder: 'noreply@acme.com',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'From email is required',
      },
      {
        type: FormBuilderValidatorType.Regex,
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
        message: 'Must be a valid email address',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'From name',
    model: 'config.fromName',
    span: [24, 12],
    category: 'Sender',
    placeholder: 'Acme Notifications',
    helpText: 'Display name shown to recipients',
  },
];
