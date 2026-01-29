import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
} from '@noco-integrations/core';
import { HubspotNodeBase } from '../../../base';
import { CrmObjectType } from '../../../utils/constants';
import type {
  FormDefinition,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { HubspotNodeConfig } from '../../../utils/types';

interface UpdateContactConfig extends HubspotNodeConfig {
  contactId: string;
  fieldsToUpdate?: string[];
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  additionalProperties?: Record<string, unknown>;
}

export class UpdateContactNode extends HubspotNodeBase<UpdateContactConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      this.getAuthFormField(),
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Contact',
        model: 'config.contactId',
        helpText: 'Select a contact or enter an ID/expression',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_contacts',
            searchable: true,
            placeholder: 'Search for a contact...',
          },
          {
            type: 'manual',
            placeholder: 'Enter contact ID or expression...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Contact is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Fields to Update',
        model: 'config.fieldsToUpdate',
        selectMode: 'multiple',
        placeholder: 'Select fields to update...',
        helpText:
          'Only selected fields will be updated. Leave a field empty to clear its value.',
        options: [
          { label: 'Email', value: 'email' },
          { label: 'First Name', value: 'firstName' },
          { label: 'Last Name', value: 'lastName' },
          { label: 'Phone', value: 'phone' },
          { label: 'Company', value: 'company' },
          { label: 'Job Title', value: 'jobTitle' },
          { label: 'Lifecycle Stage', value: 'lifecycleStage' },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Email',
        model: 'config.email',
        placeholder: 'contact@example.com (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['email'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'First Name',
        model: 'config.firstName',
        placeholder: 'John (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['firstName'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Last Name',
        model: 'config.lastName',
        placeholder: 'Doe (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['lastName'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Phone',
        model: 'config.phone',
        placeholder: '+1234567890 (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['phone'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company',
        model: 'config.company',
        placeholder: 'Acme Inc. (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['company'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Job Title',
        model: 'config.jobTitle',
        placeholder: 'Software Engineer (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['jobTitle'] },
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Lifecycle Stage',
        model: 'config.lifecycleStage',
        placeholder: 'Select lifecycle stage (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['lifecycleStage'] },
        options: [
          { label: 'Subscriber', value: 'subscriber' },
          { label: 'Lead', value: 'lead' },
          {
            label: 'Marketing Qualified Lead',
            value: 'marketingqualifiedlead',
          },
          { label: 'Sales Qualified Lead', value: 'salesqualifiedlead' },
          { label: 'Opportunity', value: 'opportunity' },
          { label: 'Customer', value: 'customer' },
          { label: 'Evangelist', value: 'evangelist' },
          { label: 'Other', value: 'other' },
        ],
      },
      {
        type: FormBuilderInputType.KeyValue,
        label: 'Additional Properties',
        model: 'config.additionalProperties',
        keyLabel: 'Property',
        valueLabel: 'Value',
        placeholder: 'Add property',
        helpText: 'Add any additional HubSpot contact properties',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.contact_update',
      title: 'Update Contact',
      description: 'Update an existing contact in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      hidden: true,
      keywords: ['hubspot', 'crm', 'contact', 'update', 'edit', 'modify'],
    };
  }

  /**
   * Fetch options for dynamic fields (e.g., contact list for EntitySelector)
   */
  public async fetchOptions(key: string, searchQuery?: string) {
    switch (key) {
      case 'hubspot_contacts': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const properties = ['email', 'firstname', 'lastname'];

          const response = await this.useHubspot(async (client) => {
            // Use search API when a query is provided
            if (searchQuery && searchQuery.trim()) {
              const res = await client.post(
                `/crm/v3/objects/${CrmObjectType.CONTACTS}/search`,
                {
                  query: searchQuery.trim(),
                  limit: 50,
                  properties,
                },
              );
              return res.data;
            }

            // Otherwise, fetch recent contacts
            const res = await client.get(
              `/crm/v3/objects/${CrmObjectType.CONTACTS}`,
              {
                params: {
                  limit: 100,
                  properties: properties.join(','),
                },
              },
            );
            return res.data;
          });

          return (response.results || []).map((contact: any) => {
            const email = contact.properties?.email || '';
            const firstName = contact.properties?.firstname || '';
            const lastName = contact.properties?.lastname || '';
            const displayName =
              [firstName, lastName].filter(Boolean).join(' ') ||
              email ||
              `Contact ${contact.id}`;

            return {
              label: email ? `${displayName} (${email})` : displayName,
              value: contact.id,
            };
          });
        } catch (error) {
          console.error('Failed to fetch HubSpot contacts:', error);
          return [];
        }
      }
      default:
        return [];
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.contactId',
        type: NocoSDK.VariableType.String,
        name: 'Contact ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the contact to update',
        },
      },
    ];

    if (this.config.email) {
      inputs.push({
        key: 'config.email',
        type: NocoSDK.VariableType.String,
        name: 'Email',
        extra: { icon: 'ncMail', description: 'Email address of the contact' },
      });
    }
    if (this.config.firstName) {
      inputs.push({
        key: 'config.firstName',
        type: NocoSDK.VariableType.String,
        name: 'First Name',
        extra: { icon: 'ncUser', description: 'First name of the contact' },
      });
    }
    if (this.config.lastName) {
      inputs.push({
        key: 'config.lastName',
        type: NocoSDK.VariableType.String,
        name: 'Last Name',
        extra: { icon: 'ncUser', description: 'Last name of the contact' },
      });
    }
    if (this.config.phone) {
      inputs.push({
        key: 'config.phone',
        type: NocoSDK.VariableType.String,
        name: 'Phone',
        extra: { icon: 'ncPhone', description: 'Phone number of the contact' },
      });
    }
    if (this.config.company) {
      inputs.push({
        key: 'config.company',
        type: NocoSDK.VariableType.String,
        name: 'Company',
        extra: { icon: 'ncBuilding', description: 'Company of the contact' },
      });
    }
    if (this.config.jobTitle) {
      inputs.push({
        key: 'config.jobTitle',
        type: NocoSDK.VariableType.String,
        name: 'Job Title',
        extra: { icon: 'ncBriefcase', description: 'Job title of the contact' },
      });
    }

    return inputs;
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
          description: 'Whether the contact was updated successfully',
        },
      },
      {
        key: 'contactId',
        type: NocoSDK.VariableType.String,
        name: 'Contact ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the updated contact',
        },
      },
      {
        key: 'contact',
        type: NocoSDK.VariableType.Object,
        name: 'Contact',
        extra: {
          icon: 'ncUser',
          description: 'The updated contact object from HubSpot',
        },
        children: [
          {
            key: 'contact.id',
            type: NocoSDK.VariableType.String,
            name: 'ID',
            extra: { icon: 'ncHash' },
          },
          {
            key: 'contact.properties',
            type: NocoSDK.VariableType.Object,
            name: 'Properties',
            children: [
              {
                key: 'contact.properties.email',
                type: NocoSDK.VariableType.String,
                name: 'Email',
                extra: { icon: 'ncMail' },
              },
              {
                key: 'contact.properties.firstname',
                type: NocoSDK.VariableType.String,
                name: 'First Name',
                extra: { icon: 'ncUser' },
              },
              {
                key: 'contact.properties.lastname',
                type: NocoSDK.VariableType.String,
                name: 'Last Name',
                extra: { icon: 'ncUser' },
              },
              {
                key: 'contact.properties.phone',
                type: NocoSDK.VariableType.String,
                name: 'Phone',
                extra: { icon: 'ncPhone' },
              },
              {
                key: 'contact.properties.company',
                type: NocoSDK.VariableType.String,
                name: 'Company',
                extra: { icon: 'ncBuilding' },
              },
              {
                key: 'contact.properties.jobtitle',
                type: NocoSDK.VariableType.String,
                name: 'Job Title',
                extra: { icon: 'ncBriefcase' },
              },
              {
                key: 'contact.properties.lifecyclestage',
                type: NocoSDK.VariableType.String,
                name: 'Lifecycle Stage',
                extra: { icon: 'ncFlag' },
              },
            ],
            extra: {
              icon: 'cellJson',
            },
          },
          {
            key: 'contact.createdAt',
            type: NocoSDK.VariableType.String,
            name: 'Created At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'contact.updatedAt',
            type: NocoSDK.VariableType.String,
            name: 'Updated At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'contact.archived',
            type: NocoSDK.VariableType.Boolean,
            name: 'Archived',
            extra: { icon: 'cellCheckbox' },
          },
          {
            key: 'contact.url',
            type: NocoSDK.VariableType.String,
            name: 'URL',
            extra: { icon: 'cellUrl' },
          },
        ],
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<UpdateContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { contactId, fieldsToUpdate, additionalProperties = {} } = config;

      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!contactId) {
        return this.createValidationError(
          'Contact ID is required',
          'MISSING_ID',
          logs,
          startTime,
        );
      }

      const properties: Record<string, unknown> = {};
      const selectedFields = new Set(fieldsToUpdate || []);

      // Field mapping: config key -> HubSpot property name
      const fieldMap: Record<
        string,
        { key: keyof typeof config; prop: string }
      > = {
        email: { key: 'email', prop: 'email' },
        firstName: { key: 'firstName', prop: 'firstname' },
        lastName: { key: 'lastName', prop: 'lastname' },
        phone: { key: 'phone', prop: 'phone' },
        company: { key: 'company', prop: 'company' },
        jobTitle: { key: 'jobTitle', prop: 'jobtitle' },
        lifecycleStage: { key: 'lifecycleStage', prop: 'lifecyclestage' },
      };

      // Only include fields that are selected in fieldsToUpdate
      // Empty values are sent as empty string to clear the field
      for (const [fieldKey, mapping] of Object.entries(fieldMap)) {
        if (selectedFields.has(fieldKey)) {
          const value = config[mapping.key];
          // Convert to string, empty if null/undefined/empty array
          if (Array.isArray(value)) {
            properties[mapping.prop] = value.length > 0 ? value[0] : '';
          } else {
            properties[mapping.prop] = value ?? '';
          }
        }
      }

      // Add additional properties (these are always included if provided)
      if (additionalProperties) {
        for (const [key, value] of Object.entries(additionalProperties)) {
          properties[key] = value ?? '';
        }
      }

      if (Object.keys(properties).length === 0) {
        return this.createValidationError(
          'At least one property is required to update',
          'NO_PROPERTIES',
          logs,
          startTime,
        );
      }

      this.logInfo(logs, `Updating contact: ${contactId}`);

      const contact = await this.useHubspot(async (client) => {
        const res = await client.patch(
          `/crm/v3/objects/${CrmObjectType.CONTACTS}/${contactId}`,
          { properties },
        );
        return res.data;
      });

      this.logInfo(logs, `Contact updated successfully: ${contact.id}`);

      return this.createSuccessResult(
        { contact, contactId: contact.id },
        logs,
        startTime,
      );
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
