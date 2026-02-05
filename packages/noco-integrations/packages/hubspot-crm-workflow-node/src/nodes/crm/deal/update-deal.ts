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

interface UpdateDealConfig extends HubspotNodeConfig {
  dealId: string;
  fieldsToUpdate?: string[];
  dealName?: string;
  amount?: number;
  pipeline?: string;
  dealStage?: string;
  closeDate?: string;
  ownerId?: string;
  additionalProperties?: Record<string, unknown>;
}

export class UpdateDealNode extends HubspotNodeBase<UpdateDealConfig> {
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
        type: FormBuilderInputType.Select,
        label: 'Fields to Update',
        model: 'config.fieldsToUpdate',
        selectMode: 'multiple',
        placeholder: 'Select fields to update...',
        helpText:
          'Only selected fields will be updated. Leave a field empty to clear its value.',
        options: [
          { label: 'Deal Name', value: 'dealName' },
          { label: 'Amount', value: 'amount' },
          { label: 'Pipeline', value: 'pipeline' },
          { label: 'Deal Stage', value: 'dealStage' },
          { label: 'Close Date', value: 'closeDate' },
          { label: 'Owner', value: 'ownerId' },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Deal Name',
        model: 'config.dealName',
        placeholder: 'New Business Deal (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['dealName'] },
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Amount',
        model: 'config.amount',
        placeholder: '10000 (leave empty to clear)',
        condition: { model: 'config.fieldsToUpdate', in: ['amount'] },
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
        condition: { model: 'config.fieldsToUpdate', in: ['pipeline'] },
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
        condition: { model: 'config.fieldsToUpdate', in: ['dealStage'] },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Close Date',
        model: 'config.closeDate',
        placeholder: 'YYYY-MM-DD (leave empty to clear)',
        helpText: 'Expected close date in YYYY-MM-DD format',
        condition: { model: 'config.fieldsToUpdate', in: ['closeDate'] },
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
        condition: { model: 'config.fieldsToUpdate', in: ['ownerId'] },
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
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'hubspot_crm.action.deal_update',
      title: 'Update Deal',
      description: 'Update an existing deal in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['hubspot', 'crm', 'deal', 'update', 'edit', 'modify'],
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
          description: 'The ID of the deal to update',
        },
      },
    ];

    if (this.config.dealName) {
      inputs.push({
        key: 'config.dealName',
        type: NocoSDK.VariableType.String,
        name: 'Deal Name',
        extra: { icon: 'ncDollarSign', description: 'Name of the deal' },
      });
    }
    if (this.config.amount !== undefined) {
      inputs.push({
        key: 'config.amount',
        type: NocoSDK.VariableType.Number,
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
          description: 'Whether the deal was updated successfully',
        },
      },
      {
        key: 'dealId',
        type: NocoSDK.VariableType.String,
        name: 'Deal ID',
        extra: {
          icon: 'ncHash',
          description: 'The ID of the updated deal',
        },
      },
      {
        key: 'deal',
        type: NocoSDK.VariableType.Object,
        name: 'Deal',
        extra: {
          icon: 'ncDollarSign',
          description: 'The updated deal object from HubSpot',
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
    ctx: WorkflowNodeRunContext<UpdateDealConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { dealId, fieldsToUpdate, additionalProperties = {} } = config;

      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      if (!dealId) {
        return this.createValidationError(
          'Deal ID is required',
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
        dealName: { key: 'dealName', prop: 'dealname' },
        amount: { key: 'amount', prop: 'amount' },
        pipeline: { key: 'pipeline', prop: 'pipeline' },
        dealStage: { key: 'dealStage', prop: 'dealstage' },
        closeDate: { key: 'closeDate', prop: 'closedate' },
        ownerId: { key: 'ownerId', prop: 'hubspot_owner_id' },
      };

      // Only include fields that are selected in fieldsToUpdate
      for (const [fieldKey, mapping] of Object.entries(fieldMap)) {
        if (selectedFields.has(fieldKey)) {
          let value = config[mapping.key];
          if (Array.isArray(value)) {
            value = value.length > 0 ? value[0] : '';
          }
          // Parse amount as number
          if (fieldKey === 'amount' && value) {
            properties[mapping.prop] = parseFloat(String(value));
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

      this.logInfo(logs, `Updating deal: ${dealId}`);

      const deal = await this.useHubspot(async (client) => {
        const res = await client.patch(
          `/crm/v3/objects/${CrmObjectType.DEALS}/${dealId}`,
          { properties },
        );
        return res.data;
      });

      this.logInfo(logs, `Deal updated successfully: ${deal.id}`);

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
