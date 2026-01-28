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

interface UpdateCompanyConfig extends HubspotNodeConfig {
  companyId: string;
  fieldsToUpdate?: string[];
  name?: string;
  domain?: string;
  industry?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  numberOfEmployees?: number;
  annualRevenue?: number;
  additionalProperties?: Record<string, unknown>;
}

export class UpdateCompanyNode extends HubspotNodeBase<UpdateCompanyConfig> {
  /**
   * Fetch options for dynamic fields (e.g., company list for EntitySelector)
   */
  public async fetchOptions(key: string, searchQuery?: string) {
    switch (key) {
      case 'hubspot_companies': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const properties = ['name', 'domain'];

          const response = await this.useHubspot(async (client) => {
            // Use search API when a query is provided
            if (searchQuery && searchQuery.trim()) {
              const res = await client.post(
                `/crm/v3/objects/${CrmObjectType.COMPANIES}/search`,
                {
                  query: searchQuery.trim(),
                  limit: 50,
                  properties,
                },
              );
              return res.data;
            }

            // Otherwise, fetch recent companies
            const res = await client.get(
              `/crm/v3/objects/${CrmObjectType.COMPANIES}`,
              {
                params: {
                  limit: 100,
                  properties: properties.join(','),
                },
              },
            );
            return res.data;
          });

          return (response.results || []).map((company: any) => {
            const name = company.properties?.name || '';
            const domain = company.properties?.domain || '';
            const displayName = name || domain || `Company ${company.id}`;

            return {
              label: domain ? `${displayName} (${domain})` : displayName,
              value: company.id,
            };
          });
        } catch (error) {
          console.error('Failed to fetch HubSpot companies:', error);
          return [];
        }
      }
      case 'hubspot_industry_options': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          // Fetch industry property options from HubSpot
          const response = await this.useHubspot(async (client) => {
            const res = await client.get(
              `/crm/v3/properties/${CrmObjectType.COMPANIES}/industry`,
            );
            return res.data;
          });

          // Return options from the property definition
          if (response?.options?.length) {
            return response.options.map(
              (opt: { label: string; value: string }) => ({
                label: opt.label,
                value: opt.value,
              }),
            );
          }

          return [];
        } catch (error) {
          console.error('Failed to fetch HubSpot industry options:', error);
          return [];
        }
      }
      default:
        return [];
    }
  }

  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      this.getAuthFormField(),
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Company',
        model: 'config.companyId',
        helpText: 'Select a company or enter an ID/expression',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_companies',
            searchable: true,
            placeholder: 'Search for a company...',
          },
          {
            type: 'manual',
            placeholder: 'Enter company ID or expression...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Company is required',
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
          { label: 'Company Name', value: 'name' },
          { label: 'Domain', value: 'domain' },
          { label: 'Industry', value: 'industry' },
          { label: 'Phone', value: 'phone' },
          { label: 'City', value: 'city' },
          { label: 'State/Region', value: 'state' },
          { label: 'Country', value: 'country' },
          { label: 'Number of Employees', value: 'numberOfEmployees' },
          { label: 'Annual Revenue', value: 'annualRevenue' },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company Name',
        model: 'config.name',
        placeholder: 'Acme Inc. (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['name'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Domain',
        model: 'config.domain',
        placeholder: 'acme.com (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['domain'] },
      },
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Industry',
        model: 'config.industry',
        helpText: 'Select an industry or enter a custom value',
        condition: { model: 'config.fieldsToUpdate', in: ['industry'] },
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_industry_options',
            searchable: true,
            placeholder: 'Select industry (leave empty to clear)...',
          },
          {
            type: 'manual',
            placeholder: 'Enter custom industry (leave empty to clear)...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
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
        label: 'City',
        model: 'config.city',
        placeholder: 'San Francisco (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['city'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'State/Region',
        model: 'config.state',
        placeholder: 'California (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['state'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Country',
        model: 'config.country',
        placeholder: 'United States (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['country'] },
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Number of Employees',
        model: 'config.numberOfEmployees',
        placeholder: '100 (leave empty to clear)',
        condition: {
          model: 'config.fieldsToUpdate',
          in: ['numberOfEmployees'],
        },
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Annual Revenue',
        model: 'config.annualRevenue',
        placeholder: '1000000 (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['annualRevenue'] },
      },
      {
        type: FormBuilderInputType.KeyValue,
        label: 'Additional Properties',
        model: 'config.additionalProperties',
        keyLabel: 'Property',
        valueLabel: 'Value',
        placeholder: 'Add property',
        helpText: 'Add any additional HubSpot company properties',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.company_update',
      title: 'Update Company',
      description: 'Update an existing company in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      hidden: true,
      keywords: ['hubspot', 'crm', 'company', 'update', 'edit', 'modify'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.companyId',
        type: NocoSDK.VariableType.String,
        name: 'Company ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the company to update',
        },
      },
    ];

    if (this.config.name) {
      inputs.push({
        key: 'config.name',
        type: NocoSDK.VariableType.String,
        name: 'Company Name',
        extra: { icon: 'ncBuilding', description: 'Name of the company' },
      });
    }
    if (this.config.domain) {
      inputs.push({
        key: 'config.domain',
        type: NocoSDK.VariableType.String,
        name: 'Domain',
        extra: { icon: 'ncGlobe', description: 'Company domain' },
      });
    }
    if (this.config.industry) {
      inputs.push({
        key: 'config.industry',
        type: NocoSDK.VariableType.String,
        name: 'Industry',
        extra: { icon: 'ncBriefcase', description: 'Company industry' },
      });
    }
    if (this.config.phone) {
      inputs.push({
        key: 'config.phone',
        type: NocoSDK.VariableType.String,
        name: 'Phone',
        extra: { icon: 'ncPhone', description: 'Company phone number' },
      });
    }
    if (this.config.city) {
      inputs.push({
        key: 'config.city',
        type: NocoSDK.VariableType.String,
        name: 'City',
        extra: { icon: 'ncMapPin', description: 'Company city' },
      });
    }
    if (this.config.state) {
      inputs.push({
        key: 'config.state',
        type: NocoSDK.VariableType.String,
        name: 'State/Region',
        extra: { icon: 'ncMapPin', description: 'Company state or region' },
      });
    }
    if (this.config.country) {
      inputs.push({
        key: 'config.country',
        type: NocoSDK.VariableType.String,
        name: 'Country',
        extra: { icon: 'ncGlobe', description: 'Company country' },
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
          description: 'Whether the company was updated successfully',
        },
      },
      {
        key: 'companyId',
        type: NocoSDK.VariableType.String,
        name: 'Company ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the updated company',
        },
      },
      {
        key: 'company',
        type: NocoSDK.VariableType.Object,
        name: 'Company',
        extra: {
          icon: 'ncBuilding',
          description: 'The updated company object from HubSpot',
        },
        children: [
          {
            key: 'company.id',
            type: NocoSDK.VariableType.String,
            name: 'ID',
            extra: { icon: 'ncHash' },
          },
          {
            key: 'company.properties',
            type: NocoSDK.VariableType.Object,
            name: 'Properties',
            children: [
              {
                key: 'company.properties.name',
                type: NocoSDK.VariableType.String,
                name: 'Name',
                extra: { icon: 'ncBuilding' },
              },
              {
                key: 'company.properties.domain',
                type: NocoSDK.VariableType.String,
                name: 'Domain',
                extra: { icon: 'ncGlobe' },
              },
              {
                key: 'company.properties.industry',
                type: NocoSDK.VariableType.String,
                name: 'Industry',
                extra: { icon: 'ncBriefcase' },
              },
              {
                key: 'company.properties.phone',
                type: NocoSDK.VariableType.String,
                name: 'Phone',
                extra: { icon: 'ncPhone' },
              },
              {
                key: 'company.properties.city',
                type: NocoSDK.VariableType.String,
                name: 'City',
                extra: { icon: 'ncMapPin' },
              },
              {
                key: 'company.properties.state',
                type: NocoSDK.VariableType.String,
                name: 'State',
                extra: { icon: 'ncMapPin' },
              },
              {
                key: 'company.properties.country',
                type: NocoSDK.VariableType.String,
                name: 'Country',
                extra: { icon: 'ncGlobe' },
              },
            ],
            extra: {
              icon: 'cellJson',
            },
          },
          {
            key: 'company.createdAt',
            type: NocoSDK.VariableType.String,
            name: 'Created At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'company.updatedAt',
            type: NocoSDK.VariableType.String,
            name: 'Updated At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'company.archived',
            type: NocoSDK.VariableType.Boolean,
            name: 'Archived',
            extra: { icon: 'cellCheckbox' },
          },
          {
            key: 'company.url',
            type: NocoSDK.VariableType.String,
            name: 'URL',
            extra: { icon: 'cellUrl' },
          },
        ],
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<UpdateCompanyConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { companyId, fieldsToUpdate, additionalProperties = {} } = config;

      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!companyId) {
        return this.createValidationError(
          'Company ID is required',
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
        name: { key: 'name', prop: 'name' },
        domain: { key: 'domain', prop: 'domain' },
        industry: { key: 'industry', prop: 'industry' },
        phone: { key: 'phone', prop: 'phone' },
        city: { key: 'city', prop: 'city' },
        state: { key: 'state', prop: 'state' },
        country: { key: 'country', prop: 'country' },
        numberOfEmployees: {
          key: 'numberOfEmployees',
          prop: 'numberofemployees',
        },
        annualRevenue: { key: 'annualRevenue', prop: 'annualrevenue' },
      };

      // Only include fields that are selected in fieldsToUpdate
      // Empty values are sent as empty string to clear the field
      for (const [fieldKey, mapping] of Object.entries(fieldMap)) {
        if (selectedFields.has(fieldKey)) {
          const value = config[mapping.key];
          // Convert to string/number, empty if null/undefined
          if (Array.isArray(value)) {
            properties[mapping.prop] = value.length > 0 ? value[0] : '';
          } else {
            properties[mapping.prop] = value ?? '';
          }
        }
      }

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

      this.logInfo(logs, `Updating company: ${companyId}`);

      const company = await this.useHubspot(async (client) => {
        const res = await client.patch(
          `/crm/v3/objects/${CrmObjectType.COMPANIES}/${companyId}`,
          { properties },
        );
        return res.data;
      });

      this.logInfo(logs, `Company updated successfully: ${company.id}`);

      return this.createSuccessResult(
        { company, companyId: company.id },
        logs,
        startTime,
      );
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
