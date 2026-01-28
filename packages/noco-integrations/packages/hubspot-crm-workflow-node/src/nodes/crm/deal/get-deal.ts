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

interface GetDealConfig extends HubspotNodeConfig {
  dealId: string;
  properties?: string;
}

export class GetDealNode extends HubspotNodeBase<GetDealConfig> {
  /**
   * Fetch options for dynamic fields
   */
  public async fetchOptions(key: string, searchQuery?: string) {
    switch (key) {
      case 'hubspot_deals': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const properties = ['dealname', 'amount', 'dealstage'];

          const response = await this.useHubspot(async (client) => {
            if (searchQuery && searchQuery.trim()) {
              const res = await client.post(
                `/crm/v3/objects/${CrmObjectType.DEALS}/search`,
                {
                  query: searchQuery.trim(),
                  limit: 50,
                  properties,
                },
              );
              return res.data;
            }

            const res = await client.get(
              `/crm/v3/objects/${CrmObjectType.DEALS}`,
              {
                params: {
                  limit: 100,
                  properties: properties.join(','),
                },
              },
            );
            return res.data;
          });

          return (response.results || []).map((deal: any) => {
            const dealName = deal.properties?.dealname || `Deal ${deal.id}`;
            const amount = deal.properties?.amount;
            const label = amount
              ? `${dealName} ($${Number(amount).toLocaleString()})`
              : dealName;

            return {
              label,
              value: deal.id,
            };
          });
        } catch (error) {
          console.error('Failed to fetch HubSpot deals:', error);
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
        label: 'Deal',
        model: 'config.dealId',
        helpText: 'Select a deal or enter an ID/expression',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_deals',
            searchable: true,
            placeholder: 'Search for a deal...',
          },
          {
            type: 'manual',
            placeholder: 'Enter deal ID or expression...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Deal is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Properties',
        model: 'config.properties',
        placeholder: 'dealname,amount,dealstage',
        helpText:
          'Comma-separated list of properties to return. Leave empty for default properties.',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.deal_get',
      title: 'Get Deal',
      description: 'Get a deal by ID from HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      hidden: true,
      keywords: ['hubspot', 'crm', 'deal', 'get', 'fetch', 'retrieve'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.dealId',
        type: NocoSDK.VariableType.String,
        name: 'Deal ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the deal to retrieve',
        },
      },
    ];

    if (this.config.properties) {
      inputs.push({
        key: 'config.properties',
        type: NocoSDK.VariableType.String,
        name: 'Properties',
        extra: {
          icon: 'ncList',
          description: 'Comma-separated list of properties to return',
        },
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
          description: 'Whether the deal was retrieved successfully',
        },
      },
      {
        key: 'dealId',
        type: NocoSDK.VariableType.String,
        name: 'Deal ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the retrieved deal',
        },
      },
      {
        key: 'deal',
        type: NocoSDK.VariableType.Object,
        name: 'Deal',
        extra: {
          icon: 'ncDollarSign',
          description: 'The deal object from HubSpot',
        },
        children: [
          {
            key: 'deal.id',
            type: NocoSDK.VariableType.String,
            name: 'ID',
            extra: { icon: 'ncHash' },
          },
          {
            key: 'deal.properties',
            type: NocoSDK.VariableType.Object,
            name: 'Properties',
            children: [
              {
                key: 'deal.properties.dealname',
                type: NocoSDK.VariableType.String,
                name: 'Deal Name',
                extra: { icon: 'ncDollarSign' },
              },
              {
                key: 'deal.properties.amount',
                type: NocoSDK.VariableType.Number,
                name: 'Amount',
                extra: { icon: 'ncDollarSign' },
              },
              {
                key: 'deal.properties.dealstage',
                type: NocoSDK.VariableType.String,
                name: 'Deal Stage',
                extra: { icon: 'ncFlag' },
              },
              {
                key: 'deal.properties.pipeline',
                type: NocoSDK.VariableType.String,
                name: 'Pipeline',
                extra: { icon: 'ncGitBranch' },
              },
              {
                key: 'deal.properties.closedate',
                type: NocoSDK.VariableType.String,
                name: 'Close Date',
                extra: { icon: 'cellDatetime' },
              },
              {
                key: 'deal.properties.hubspot_owner_id',
                type: NocoSDK.VariableType.String,
                name: 'Owner ID',
                extra: { icon: 'ncUser' },
              },
            ],
            extra: {
              icon: 'cellJson',
            },
          },
          {
            key: 'deal.createdAt',
            type: NocoSDK.VariableType.String,
            name: 'Created At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'deal.updatedAt',
            type: NocoSDK.VariableType.String,
            name: 'Updated At',
            extra: { icon: 'cellDatetime' },
          },
          {
            key: 'deal.archived',
            type: NocoSDK.VariableType.Boolean,
            name: 'Archived',
            extra: { icon: 'cellCheckbox' },
          },
          {
            key: 'deal.url',
            type: NocoSDK.VariableType.String,
            name: 'URL',
            extra: { icon: 'cellUrl' },
          },
        ],
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<GetDealConfig>,
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

      if (!config.dealId) {
        return this.createValidationError(
          'Deal ID is required',
          'MISSING_ID',
          logs,
          startTime,
        );
      }

      const properties = config.properties
        ? config.properties.split(',').map((p) => p.trim())
        : DEFAULT_PROPERTIES[CrmObjectType.DEALS];

      this.logInfo(logs, `Getting deal: ${config.dealId}`);

      const deal = await this.useHubspot(async (client) => {
        const res = await client.get(
          `/crm/v3/objects/${CrmObjectType.DEALS}/${config.dealId}`,
          { params: { properties: properties.join(',') } },
        );
        return res.data;
      });

      this.logInfo(logs, `Deal retrieved successfully: ${deal.id}`);

      return this.createSuccessResult(
        { deal, dealId: deal.id },
        logs,
        startTime,
      );
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
