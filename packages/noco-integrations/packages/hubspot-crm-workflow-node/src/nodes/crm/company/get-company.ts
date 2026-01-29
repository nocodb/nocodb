import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
} from '@noco-integrations/core';
import { HubspotNodeBase } from '../../../base';
import { CrmObjectType, DEFAULT_PROPERTIES } from '../../../utils/constants';
import type {
  FormDefinition,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { HubspotNodeConfig } from '../../../utils/types';

interface GetCompanyConfig extends HubspotNodeConfig {
  companyId: string;
  properties?: string;
}

export class GetCompanyNode extends HubspotNodeBase<GetCompanyConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      this.getAuthFormField(),
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company ID',
        model: 'config.companyId',
        placeholder: '123456789',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Company ID is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Properties',
        model: 'config.properties',
        placeholder: 'name,domain,industry',
        helpText:
          'Comma-separated list of properties to return. Leave empty for default properties.',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.company_get',
      title: 'Get Company',
      description: 'Get a company by ID from HubSpot CRM',
      icon: 'hubspot',
      hidden: true,
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['hubspot', 'crm', 'company', 'get', 'fetch', 'retrieve'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.companyId',
        type: NocoSDK.VariableType.String,
        name: 'Company ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the company to retrieve',
        },
      },
      ...(this.config.properties
        ? [
            {
              key: 'config.properties',
              type: NocoSDK.VariableType.String,
              name: 'Properties',
              extra: {
                icon: 'ncList',
                description: 'Comma-separated list of properties to return',
              },
            },
          ]
        : []),
    ];
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
          description: 'Whether the company was retrieved successfully',
        },
      },
      {
        key: 'companyId',
        type: NocoSDK.VariableType.String,
        name: 'Company ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the retrieved company',
        },
      },
      {
        key: 'company',
        type: NocoSDK.VariableType.Object,
        name: 'Company',
        extra: {
          icon: 'ncBuilding',
          description: 'The company object from HubSpot',
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
    ctx: WorkflowNodeRunContext<GetCompanyConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!config.companyId) {
        return this.createValidationError(
          'Company ID is required',
          'MISSING_ID',
          logs,
          startTime,
        );
      }

      const properties = config.properties
        ? config.properties.split(',').map((p) => p.trim())
        : DEFAULT_PROPERTIES[CrmObjectType.COMPANIES];

      this.logInfo(logs, `Getting company: ${config.companyId}`);

      const company = await this.useHubspot(async (client) => {
        const res = await client.get(
          `/crm/v3/objects/${CrmObjectType.COMPANIES}/${config.companyId}`,
          { params: { properties: properties.join(',') } },
        );
        return res.data;
      });

      this.logInfo(logs, `Company retrieved successfully: ${company.id}`);

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
