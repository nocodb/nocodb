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

interface CreateDealConfig extends HubspotNodeConfig {
  dealName: string;
  amount?: string;
  pipeline?: string;
  dealStage?: string;
  closeDate?: string;
  ownerId?: string;
  additionalProperties?: Record<string, unknown>;
}

export class CreateDealNode extends HubspotNodeBase<CreateDealConfig> {
  /**
   * Fetch options for dynamic fields (e.g., pipelines, deal stages, owners)
   */
  public async fetchOptions(key: string, _searchQuery?: string) {
    switch (key) {
      case 'hubspot_deal_pipelines': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const response = await this.useHubspot(async (client) => {
            const res = await client.get('/crm/v3/pipelines/deals');
            return res.data;
          });

          return (response.results || []).map(
            (pipeline: { id: string; label: string }) => ({
              label: pipeline.label,
              value: pipeline.id,
            }),
          );
        } catch (error) {
          console.error('Failed to fetch HubSpot pipelines:', error);
          return [];
        }
      }
      case 'hubspot_deal_stages': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const pipelineId = this.config.pipeline || 'default';
          const response = await this.useHubspot(async (client) => {
            const res = await client.get(
              `/crm/v3/pipelines/deals/${pipelineId}`,
            );
            return res.data;
          });

          return (response.stages || []).map(
            (stage: { id: string; label: string }) => ({
              label: stage.label,
              value: stage.id,
            }),
          );
        } catch (error) {
          console.error('Failed to fetch HubSpot deal stages:', error);
          return [];
        }
      }
      case 'hubspot_owners': {
        if (!this.config.authIntegrationId) {
          return [];
        }

        try {
          const response = await this.useHubspot(async (client) => {
            const res = await client.get('/crm/v3/owners');
            return res.data;
          });

          return (response.results || []).map(
            (owner: {
              id: string;
              email: string;
              firstName?: string;
              lastName?: string;
            }) => {
              const name = [owner.firstName, owner.lastName]
                .filter(Boolean)
                .join(' ');
              return {
                label: name ? `${name} (${owner.email})` : owner.email,
                value: owner.id,
              };
            },
          );
        } catch (error) {
          console.error('Failed to fetch HubSpot owners:', error);
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
        label: 'Deal Name',
        model: 'config.dealName',
        placeholder: 'New Business Deal',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Deal name is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Amount',
        model: 'config.amount',
        placeholder: '10000',
        helpText: 'Deal amount in your default currency',
      },
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Pipeline',
        model: 'config.pipeline',
        helpText: 'Select a pipeline or enter an ID',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_deal_pipelines',
            searchable: true,
            placeholder: 'Select pipeline...',
          },
          {
            type: 'manual',
            placeholder: 'Enter pipeline ID...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
      },
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Deal Stage',
        model: 'config.dealStage',
        helpText: 'Select a deal stage or enter an ID',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_deal_stages',
            searchable: true,
            placeholder: 'Select deal stage...',
          },
          {
            type: 'manual',
            placeholder: 'Enter deal stage ID...',
          },
        ],
        dependsOn: 'config.pipeline',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Close Date',
        model: 'config.closeDate',
        placeholder: 'YYYY-MM-DD',
        helpText: 'Expected close date in YYYY-MM-DD format',
      },
      {
        type: FormBuilderInputType.EntitySelector,
        label: 'Owner',
        model: 'config.ownerId',
        helpText: 'Select an owner or enter an ID',
        modes: [
          {
            type: 'list',
            fetchOptionsKey: 'hubspot_owners',
            searchable: true,
            placeholder: 'Select owner...',
          },
          {
            type: 'manual',
            placeholder: 'Enter owner ID...',
          },
        ],
        dependsOn: 'config.authIntegrationId',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.KeyValue,
        label: 'Additional Properties',
        model: 'config.additionalProperties',
        keyLabel: 'Property',
        valueLabel: 'Value',
        placeholder: 'Add property',
        helpText: 'Add any additional HubSpot deal properties',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'hubspot_crm.action.deal_create',
      title: 'Create Deal',
      description: 'Create a new deal in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      hidden: true,
      keywords: [
        'hubspot',
        'crm',
        'deal',
        'create',
        'add',
        'opportunity',
        'sales',
      ],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.dealName',
        type: NocoSDK.VariableType.String,
        name: 'Deal Name',
        extra: {
          icon: 'ncDollarSign',
          description: 'Name of the deal',
        },
      },
    ];

    if (this.config.amount) {
      inputs.push({
        key: 'config.amount',
        type: NocoSDK.VariableType.String,
        name: 'Amount',
        extra: { icon: 'ncDollarSign', description: 'Deal amount' },
      });
    }
    if (this.config.pipeline) {
      inputs.push({
        key: 'config.pipeline',
        type: NocoSDK.VariableType.String,
        name: 'Pipeline',
        extra: { icon: 'ncGitBranch', description: 'Deal pipeline' },
      });
    }
    if (this.config.dealStage) {
      inputs.push({
        key: 'config.dealStage',
        type: NocoSDK.VariableType.String,
        name: 'Deal Stage',
        extra: { icon: 'ncFlag', description: 'Deal stage' },
      });
    }
    if (this.config.closeDate) {
      inputs.push({
        key: 'config.closeDate',
        type: NocoSDK.VariableType.String,
        name: 'Close Date',
        extra: { icon: 'cellDatetime', description: 'Expected close date' },
      });
    }
    if (this.config.ownerId) {
      inputs.push({
        key: 'config.ownerId',
        type: NocoSDK.VariableType.String,
        name: 'Owner ID',
        extra: { icon: 'ncUser', description: 'HubSpot owner ID' },
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
          description: 'Whether the deal was created successfully',
        },
      },
      {
        key: 'dealId',
        type: NocoSDK.VariableType.String,
        name: 'Deal ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the created deal',
        },
      },
      {
        key: 'deal',
        type: NocoSDK.VariableType.Object,
        name: 'Deal',
        extra: {
          icon: 'ncDollarSign',
          description: 'The created deal object from HubSpot',
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
    ctx: WorkflowNodeRunContext<CreateDealConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const {
        dealName,
        amount,
        pipeline,
        dealStage,
        closeDate,
        ownerId,
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

      if (!dealName) {
        return this.createValidationError(
          'Deal name is required',
          'MISSING_DEAL_NAME',
          logs,
          startTime,
        );
      }

      const properties: Record<string, unknown> = {
        dealname: dealName,
        ...additionalProperties,
      };
      if (amount) properties.amount = parseFloat(amount);
      if (pipeline) properties.pipeline = pipeline;
      if (dealStage) properties.dealstage = dealStage;
      if (closeDate) properties.closedate = closeDate;
      if (ownerId) properties.hubspot_owner_id = ownerId;

      this.logInfo(logs, `Creating deal: ${dealName}`);

      const deal = await this.useHubspot(async (client) => {
        const res = await client.post(
          `/crm/v3/objects/${CrmObjectType.DEALS}`,
          { properties },
        );
        return res.data;
      });

      this.logInfo(logs, `Deal created successfully with ID: ${deal.id}`);

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
