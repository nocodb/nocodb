import {
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

/**
 * Form definition for Freshdesk Auth Integration
 *
 * Required fields:
 * - Integration name
 * - Freshdesk domain (e.g., yourcompany.freshdesk.com)
 * - API Key (found in Profile Settings)
 */
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
    label: 'Freshdesk Domain',
    width: 100,
    model: 'config.domain',
    category: 'General',
    placeholder: 'e.g., yourcompany.freshdesk.com',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Freshdesk domain is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 100,
    model: 'config.api_key',
    category: 'Authentication',
    placeholder: 'Enter your Freshdesk API Key',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API Key is required',
      },
    ],
  },
];
