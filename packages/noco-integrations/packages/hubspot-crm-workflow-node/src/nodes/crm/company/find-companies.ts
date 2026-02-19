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

interface FindCompaniesConfig extends HubspotNodeConfig {
  filters?: ConditionBuilderValue;
  properties?: string;
  limit?: number;
}

export class FindCompaniesNode extends HubspotNodeBase<FindCompaniesConfig> {
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
        helpText: 'Build conditions to filter companies',
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
          { label: 'Company Name', value: 'name' },
          { label: 'Domain', value: 'domain' },
          { label: 'Industry', value: 'industry' },
          { label: 'Phone', value: 'phone' },
          { label: 'City', value: 'city' },
          { label: 'State', value: 'state' },
          { label: 'Country', value: 'country' },
          { label: 'Postal Code', value: 'zip' },
          { label: 'Number of Employees', value: 'numberofemployees' },
          { label: 'Annual Revenue', value: 'annualrevenue' },
          { label: 'Lifecycle Stage', value: 'lifecyclestage' },
          { label: 'Lead Status', value: 'hs_lead_status' },
          { label: 'Owner', value: 'hubspot_owner_id' },
          { label: 'Create Date', value: 'createdate' },
          { label: 'Last Modified Date', value: 'lastmodifieddate' },
          { label: 'Website', value: 'website' },
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
      {
        type: FormBuilderInputType.Number,
        label: 'Limit',
        model: 'config.limit',
        defaultValue: 100,
        helpText: 'Maximum number of companies to return (max 100)',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'hubspot_crm.action.company_find',
      title: 'Find Companies',
      description: 'Search for companies in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['hubspot', 'crm', 'company', 'find', 'search', 'query'],
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
          description: 'Maximum number of companies to return',
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
          description: 'Total number of companies matching the search',
        },
      },
      {
        key: 'companies',
        type: NocoSDK.VariableType.Array,
        name: 'Companies',
        extra: {
          icon: 'ncBuilding',
          description: 'List of companies found',
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
                  key: 'properties.name',
                  type: NocoSDK.VariableType.String,
                  name: 'Name',
                  extra: { icon: 'ncBuilding' },
                },
                {
                  key: 'properties.domain',
                  type: NocoSDK.VariableType.String,
                  name: 'Domain',
                  extra: { icon: 'ncGlobe' },
                },
                {
                  key: 'properties.industry',
                  type: NocoSDK.VariableType.String,
                  name: 'Industry',
                  extra: { icon: 'ncBriefcase' },
                },
                {
                  key: 'properties.phone',
                  type: NocoSDK.VariableType.String,
                  name: 'Phone',
                  extra: { icon: 'ncPhone' },
                },
                {
                  key: 'properties.city',
                  type: NocoSDK.VariableType.String,
                  name: 'City',
                  extra: { icon: 'ncMapPin' },
                },
                {
                  key: 'properties.state',
                  type: NocoSDK.VariableType.String,
                  name: 'State',
                  extra: { icon: 'ncMapPin' },
                },
                {
                  key: 'properties.country',
                  type: NocoSDK.VariableType.String,
                  name: 'Country',
                  extra: { icon: 'ncGlobe' },
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
    ctx: WorkflowNodeRunContext<FindCompaniesConfig>,
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
        : DEFAULT_PROPERTIES[CrmObjectType.COMPANIES];

      // Convert ConditionBuilder format to HubSpot filter format
      const filterGroups = this.buildFilterGroups(filters);

      this.logInfo(
        logs,
        `Searching for companies with ${filterGroups.length ? 'filters' : 'no filters'}`,
      );

      const response = await this.useHubspot(async (client) => {
        const res = await client.post(
          `/crm/v3/objects/${CrmObjectType.COMPANIES}/search`,
          {
            filterGroups,
            properties,
            limit: Math.min(limit, 100),
          },
        );
        return res.data;
      });

      const companies = response.results || [];
      const total = response.total || companies.length;

      this.logInfo(
        logs,
        `Found ${total} companies, returning ${companies.length}`,
      );

      return this.createSuccessResult({ companies, total }, logs, startTime);
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
