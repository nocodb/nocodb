import {
  FormBuilderInputType,
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

interface FilterCondition {
  leftValue: string;
  operator: { type: string; operation: string };
  rightValue?: string;
}

interface ConditionBuilderValue {
  combinator: 'and' | 'or';
  conditions: FilterCondition[];
}

interface FindDealsConfig extends HubspotNodeConfig {
  filters?: ConditionBuilderValue;
  properties?: string;
  limit?: number;
}

export class FindDealsNode extends HubspotNodeBase<FindDealsConfig> {
  // Map ConditionBuilder operators to HubSpot operators
  private readonly operatorMap: Record<string, string> = {
    equals: 'EQ',
    notEquals: 'NEQ',
    contains: 'CONTAINS_TOKEN',
    notContains: 'NOT_CONTAINS_TOKEN',
    startsWith: 'STARTS_WITH',
    endsWith: 'ENDS_WITH',
    gt: 'GT',
    gte: 'GTE',
    lt: 'LT',
    lte: 'LTE',
    exists: 'HAS_PROPERTY',
    notExists: 'NOT_HAS_PROPERTY',
    empty: 'NOT_HAS_PROPERTY',
    notEmpty: 'HAS_PROPERTY',
  };

  /**
   * Convert ConditionBuilder value to HubSpot filter groups
   */
  private buildFilterGroups(filters?: ConditionBuilderValue): Array<{
    filters: Array<{ propertyName: string; operator: string; value?: string }>;
  }> {
    if (!filters?.conditions?.length) {
      return [];
    }

    const hubspotFilters = filters.conditions
      .filter((c) => c.leftValue) // Only include conditions with a property name
      .map((condition) => ({
        propertyName: condition.leftValue,
        operator: this.operatorMap[condition.operator.operation] || 'EQ',
        ...(condition.rightValue && { value: condition.rightValue }),
      }));

    if (hubspotFilters.length === 0) {
      return [];
    }

    // HubSpot uses filterGroups for OR logic, filters within a group for AND logic
    if (filters.combinator === 'or') {
      // Each condition becomes its own filter group (OR between groups)
      return hubspotFilters.map((f) => ({ filters: [f] }));
    } else {
      // All conditions in one filter group (AND within group)
      return [{ filters: hubspotFilters }];
    }
  }

  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      this.getAuthFormField(),
      {
        type: FormBuilderInputType.ConditionBuilder,
        label: 'Search Filters',
        model: 'config.filters',
        helpText: 'Build conditions to filter deals',
        allowedTypes: ['string', 'number', 'boolean'],
        supportedOperators: [
          'equals',
          'notEquals',
          'contains',
          'notContains',
          'startsWith',
          'endsWith',
          'gt',
          'gte',
          'lt',
          'lte',
          'exists',
          'notExists',
          'empty',
          'notEmpty',
        ],
        sortable: true,
        maxConditions: 10,
        propertyPlaceholder: 'Select property',
        propertyOptions: [
          { label: 'Deal Name', value: 'dealname' },
          { label: 'Amount', value: 'amount' },
          { label: 'Deal Stage', value: 'dealstage' },
          { label: 'Pipeline', value: 'pipeline' },
          { label: 'Close Date', value: 'closedate' },
          { label: 'Create Date', value: 'createdate' },
          { label: 'Last Modified Date', value: 'hs_lastmodifieddate' },
          { label: 'Owner ID', value: 'hubspot_owner_id' },
          { label: 'Deal Type', value: 'dealtype' },
          { label: 'Description', value: 'description' },
          { label: 'Number of Contacts', value: 'num_associated_contacts' },
          { label: 'Closed Won Reason', value: 'closed_won_reason' },
          { label: 'Closed Lost Reason', value: 'closed_lost_reason' },
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
      {
        type: FormBuilderInputType.Number,
        label: 'Limit',
        model: 'config.limit',
        defaultValue: 100,
        helpText: 'Maximum number of deals to return (max 100)',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'hubspot_crm.action.deal_find',
      title: 'Find Deals',
      description: 'Search for deals in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['hubspot', 'crm', 'deal', 'find', 'search', 'query'],
    };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const inputs: NocoSDK.VariableDefinition[] = [];

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
    if (this.config.limit) {
      inputs.push({
        key: 'config.limit',
        type: NocoSDK.VariableType.Number,
        name: 'Limit',
        extra: {
          icon: 'ncHash',
          description: 'Maximum number of deals to return',
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
          description: 'Whether the search was successful',
        },
      },
      {
        key: 'total',
        type: NocoSDK.VariableType.Number,
        name: 'Total',
        extra: {
          icon: 'ncHash',
          description: 'Total number of deals matching the search',
        },
      },
      {
        key: 'deals',
        type: NocoSDK.VariableType.Array,
        name: 'Deals',
        extra: {
          icon: 'ncDollarSign',
          description: 'List of deals found',
          itemSchema: [
            {
              key: 'id',
              type: NocoSDK.VariableType.String,
              name: 'ID',
              extra: { icon: 'ncHash' },
            },
            {
              key: 'properties',
              type: NocoSDK.VariableType.Object,
              name: 'Properties',
              extra: {
                icon: 'cellJson',
              },
              children: [
                {
                  key: 'properties.dealname',
                  type: NocoSDK.VariableType.String,
                  name: 'Deal Name',
                  extra: { icon: 'ncDollarSign' },
                },
                {
                  key: 'properties.amount',
                  type: NocoSDK.VariableType.Number,
                  name: 'Amount',
                  extra: { icon: 'ncDollarSign' },
                },
                {
                  key: 'properties.dealstage',
                  type: NocoSDK.VariableType.String,
                  name: 'Deal Stage',
                  extra: { icon: 'ncFlag' },
                },
                {
                  key: 'properties.pipeline',
                  type: NocoSDK.VariableType.String,
                  name: 'Pipeline',
                  extra: { icon: 'ncGitBranch' },
                },
                {
                  key: 'properties.closedate',
                  type: NocoSDK.VariableType.String,
                  name: 'Close Date',
                  extra: { icon: 'cellDatetime' },
                },
                {
                  key: 'properties.hubspot_owner_id',
                  type: NocoSDK.VariableType.String,
                  name: 'Owner ID',
                  extra: { icon: 'ncUser' },
                },
              ],
            },
            {
              key: 'createdAt',
              type: NocoSDK.VariableType.String,
              name: 'Created At',
              extra: { icon: 'cellDatetime' },
            },
            {
              key: 'updatedAt',
              type: NocoSDK.VariableType.String,
              name: 'Updated At',
              extra: { icon: 'cellDatetime' },
            },
            {
              key: 'archived',
              type: NocoSDK.VariableType.Boolean,
              name: 'Archived',
              extra: { icon: 'cellCheckbox' },
            },
            {
              key: 'url',
              type: NocoSDK.VariableType.String,
              name: 'URL',
              extra: { icon: 'cellUrl' },
            },
          ],
        },
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<FindDealsConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { filters, limit = 100 } = config;

      if (!config.authIntegrationId) {
        return this.createValidationError(
          'HubSpot Account is required',
          'MISSING_AUTH',
          logs,
          startTime,
        );
      }

      const properties = config.properties
        ? config.properties.split(',').map((p) => p.trim())
        : DEFAULT_PROPERTIES[CrmObjectType.DEALS];

      // Convert ConditionBuilder format to HubSpot filter format
      const filterGroups = this.buildFilterGroups(filters);

      this.logInfo(
        logs,
        `Searching for deals with ${filterGroups.length ? 'filters' : 'no filters'}`,
      );

      const response = await this.useHubspot(async (client) => {
        const res = await client.post(
          `/crm/v3/objects/${CrmObjectType.DEALS}/search`,
          {
            filterGroups,
            properties,
            limit: Math.min(limit, 100),
          },
        );
        return res.data;
      });

      const deals = response.results || [];
      const total = response.total || deals.length;

      this.logInfo(logs, `Found ${total} deals, returning ${deals.length}`);

      return this.createSuccessResult({ deals, total }, logs, startTime);
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
