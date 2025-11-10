import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  IntegrationType,
} from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

/**
 * Form definition for Freshdesk Sync Integration
 * 
 * Allows users to configure:
 * - Integration name
 * - Auth integration (Freshdesk auth)
 * - Whether to include closed tickets
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
    type: FormBuilderInputType.SelectIntegration,
    label: 'Freshdesk Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'freshdesk',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Freshdesk connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include Closed Tickets',
    width: 100,
    model: 'config.includeClosed',
    category: 'Sync Options',
    defaultValue: false,
  },
];
