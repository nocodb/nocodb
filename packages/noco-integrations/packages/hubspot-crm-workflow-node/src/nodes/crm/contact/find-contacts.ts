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

interface FindContactsConfig extends HubspotNodeConfig {
  filters?: ConditionBuilderValue;
  properties?: string;
  limit?: number;
}

export class FindContactsNode extends HubspotNodeBase<FindContactsConfig> {
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
        helpText: 'Build conditions to filter contacts',
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
          { label: 'Email', value: 'email' },
          { label: 'First Name', value: 'firstname' },
          { label: 'Last Name', value: 'lastname' },
          { label: 'Phone', value: 'phone' },
          { label: 'Company', value: 'company' },
          { label: 'Job Title', value: 'jobtitle' },
          { label: 'Lifecycle Stage', value: 'lifecyclestage' },
          { label: 'Lead Status', value: 'hs_lead_status' },
          { label: 'Owner', value: 'hubspot_owner_id' },
          { label: 'Create Date', value: 'createdate' },
          { label: 'Last Modified Date', value: 'lastmodifieddate' },
          { label: 'Website', value: 'website' },
          { label: 'City', value: 'city' },
          { label: 'State', value: 'state' },
          { label: 'Country', value: 'country' },
          { label: 'Postal Code', value: 'zip' },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Properties',
        model: 'config.properties',
        placeholder: 'email,firstname,lastname',
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
        helpText: 'Maximum number of contacts to return (max 100)',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'hubspot_crm.action.contact_find',
      title: 'Find Contacts',
      description: 'Search for contacts in HubSpot CRM',
      icon: 'hubspot',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['hubspot', 'crm', 'contact', 'find', 'search', 'query'],
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
          description: 'Maximum number of contacts to return',
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
          description: 'Total number of contacts matching the search',
        },
      },
      {
        key: 'contacts',
        type: NocoSDK.VariableType.Array,
        name: 'Contacts',
        extra: {
          icon: 'ncUser',
          description: 'List of contacts found',
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
                  key: 'properties.email',
                  type: NocoSDK.VariableType.String,
                  name: 'Email',
                  extra: { icon: 'ncMail' },
                },
                {
                  key: 'properties.firstname',
                  type: NocoSDK.VariableType.String,
                  name: 'First Name',
                  extra: { icon: 'ncUser' },
                },
                {
                  key: 'properties.lastname',
                  type: NocoSDK.VariableType.String,
                  name: 'Last Name',
                  extra: { icon: 'ncUser' },
                },
                {
                  key: 'properties.phone',
                  type: NocoSDK.VariableType.String,
                  name: 'Phone',
                  extra: { icon: 'ncPhone' },
                },
                {
                  key: 'properties.company',
                  type: NocoSDK.VariableType.String,
                  name: 'Company',
                  extra: { icon: 'ncBuilding' },
                },
                {
                  key: 'properties.jobtitle',
                  type: NocoSDK.VariableType.String,
                  name: 'Job Title',
                  extra: { icon: 'ncBriefcase' },
                },
                {
                  key: 'properties.lifecyclestage',
                  type: NocoSDK.VariableType.String,
                  name: 'Lifecycle Stage',
                  extra: { icon: 'ncFlag' },
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
    ctx: WorkflowNodeRunContext<FindContactsConfig>,
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
        : DEFAULT_PROPERTIES[CrmObjectType.CONTACTS];

      // Convert ConditionBuilder format to HubSpot filter format
      const filterGroups = this.buildFilterGroups(filters);

      this.logInfo(
        logs,
        `Searching for contacts with ${filterGroups.length ? 'filters' : 'no filters'}`,
      );

      const response = await this.useHubspot(async (client) => {
        const res = await client.post(
          `/crm/v3/objects/${CrmObjectType.CONTACTS}/search`,
          {
            filterGroups,
            properties,
            limit: Math.min(limit, 100),
          },
        );
        return res.data;
      });

      const contacts = response.results || [];
      const total = response.total || contacts.length;

      this.logInfo(
        logs,
        `Found ${total} contacts, returning ${contacts.length}`,
      );

      return this.createSuccessResult({ contacts, total }, logs, startTime);
    } catch (error) {
      return this.handleError(error, logs, startTime);
    }
  }
}
