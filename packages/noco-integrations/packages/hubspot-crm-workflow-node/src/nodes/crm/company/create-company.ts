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

interface CreateCompanyConfig extends HubspotNodeConfig {
  name: string;
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

export class CreateCompanyNode extends HubspotNodeBase<CreateCompanyConfig> {
  /**
   * Fetch options for dynamic fields (e.g., industry options)
   */
  public async fetchOptions(key: string, _searchQuery?: string) {
    switch (key) {
      case 'hubspot_industry_options': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const response = await this.useHubspot(async (client) => {
            const res = await client.get(
              `/crm/v3/properties/${CrmObjectType.COMPANIES}/industry`,
            );
            return res.data;
          });

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
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company Name',
        model: 'config.name',
        placeholder: 'Acme Inc.',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Company name is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Domain',
        model: 'config.domain',
        placeholder: 'acme.com',
      },
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Industry',
        model: 'config.industry',
        helpText: 'Select an industry or enter a custom value',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_industry_options',
            searchable: true,
            placeholder: 'Select industry...',
          },
          {
            type: 'manual',
            placeholder: 'Enter custom industry...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Phone',
        model: 'config.phone',
        placeholder: '+1234567890',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'City',
        model: 'config.city',
        placeholder: 'San Francisco',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'State/Region',
        model: 'config.state',
        placeholder: 'California',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Country',
        model: 'config.country',
        placeholder: 'United States',
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Number of Employees',
        model: 'config.numberOfEmployees',
        placeholder: '100',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Annual Revenue',
        model: 'config.annualRevenue',
        placeholder: '1000000',
        group: 'moreOptions',
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
      },
    ];

    return {
      id: 'hubspot_crm.action.company_create',
      title: 'Create Company',
      description: 'Create a new company in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['hubspot', 'crm', 'company', 'create', 'add', 'organization'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.name',
        type: NocoSDK.VariableType.String,
        name: 'Company Name',
        extra: {
          icon: 'ncBuilding',
          description: 'Name of the company',
        },
      },
    ];

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
          description: 'Whether the company was created successfully',
        },
      },
      {
        key: 'companyId',
        type: NocoSDK.VariableType.String,
        name: 'Company ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the created company',
        },
      },
      {
        key: 'company',
        type: NocoSDK.VariableType.Object,
        name: 'Company',
        extra: {
          icon: 'ncBuilding',
          description: 'The created company object from HubSpot',
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
    ctx: WorkflowNodeRunContext<CreateCompanyConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const {
        name,
        domain,
        industry,
        phone,
        city,
        state,
        country,
        numberOfEmployees,
        annualRevenue,
        additionalProperties = {},
      } = config;

      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!name) {
        return this.createValidationError(
          'Company name is required',
          'MISSING_NAME',
          logs,
          startTime,
        );
      }

      const properties: Record<string, unknown> = {
        name,
        ...additionalProperties,
      };
      if (domain) properties.domain = domain;
      if (industry) properties.industry = industry;
      if (phone) properties.phone = phone;
      if (city) properties.city = city;
      if (state) properties.state = state;
      if (country) properties.country = country;
      if (numberOfEmployees) properties.numberofemployees = numberOfEmployees;
      if (annualRevenue) properties.annualrevenue = annualRevenue;

      this.logInfo(logs, `Creating company: ${name}`);

      const company = await this.useHubspot(async (client) => {
        const res = await client.post(
          `/crm/v3/objects/${CrmObjectType.COMPANIES}`,
          { properties },
        );
        return res.data;
      });

      this.logInfo(logs, `Company created successfully with ID: ${company.id}`);

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
