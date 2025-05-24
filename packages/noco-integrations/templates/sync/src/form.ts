import {
  FormBuilderInputType,
  type FormDefinition,
  IntegrationType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';

/**
 * Configuration form for the sync integration
 * Defines the UI elements for configuring the integration
 */
const form: FormDefinition = [
  // Authentication integration selection
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Provider Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'provider', // Replace with actual auth integration sub_type
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Provider connection is required',
      },
    ],
  },
  
  // Project/resource identifier
  {
    type: FormBuilderInputType.Input,
    label: 'Project ID',
    width: 100,
    model: 'config.projectId',
    placeholder: 'e.g., project-123',
    category: 'Source',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Project ID is required',
      },
    ],
  },
  
  // Optional: Include closed items
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed items',
    width: 100,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: false,
  },
  
  // Optional: Add any other provider-specific configuration options here
];

export default form; 