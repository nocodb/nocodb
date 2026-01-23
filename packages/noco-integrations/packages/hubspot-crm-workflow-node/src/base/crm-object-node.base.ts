import {
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import { CrmObjectType, DEFAULT_PROPERTIES } from '../utils/constants';
import { HubspotNodeBase } from './hubspot-node.base';
import type { FormBuilderElement } from '@noco-integrations/core';
import type {
  FilterGroup,
  HubspotCrmObject,
  HubspotNodeConfig,
  HubspotOwner,
  HubspotPipeline,
  HubspotSearchResponse,
} from '../utils/types';

export interface CrmObjectNodeConfig extends HubspotNodeConfig {
  properties?: string[] | Record<string, unknown>;
  recordId?: string;
  filterGroups?: FilterGroup[];
}

export abstract class CrmObjectNodeBase<
  TConfig extends CrmObjectNodeConfig = CrmObjectNodeConfig,
> extends HubspotNodeBase<TConfig> {
  /**
   * Get the CRM object type for this node
   */
  protected abstract getObjectType(): CrmObjectType | string;

  /**
   * Get default properties to fetch for this object type
   */
  protected getDefaultProperties(): string[] {
    const objectType = this.getObjectType() as CrmObjectType;
    return DEFAULT_PROPERTIES[objectType] || [];
  }

  /**
   * Get the API endpoint for this object type
   */
  protected getApiEndpoint(): string {
    return `/crm/v3/objects/${this.getObjectType()}`;
  }

  /**
   * Fetch options for dynamic dropdowns
   */
  public async fetchOptions(
    key: string,
    _searchQuery?: string,
  ): Promise<unknown> {
    if (!this.config.authIntegrationId) {
      return [];
    }

    switch (key) {
      case 'properties':
        return this.fetchObjectProperties();
      case 'owners':
        return this.fetchOwners();
      case 'pipelines':
        return this.fetchPipelines();
      case 'stages':
        return this.fetchPipelineStages();
      case 'lists':
        return this.fetchLists();
      default:
        return [];
    }
  }

  /**
   * Fetch available properties for this object type
   */
  protected async fetchObjectProperties(): Promise<
    Array<{ label: string; value: string; type?: string; fieldType?: string }>
  > {
    return this.useHubspot(async (client) => {
      const response = await client.get(
        `/crm/v3/properties/${this.getObjectType()}`,
      );
      return response.data.results.map(
        (prop: {
          label: string;
          name: string;
          type: string;
          fieldType: string;
        }) => ({
          label: prop.label,
          value: prop.name,
          type: prop.type,
          fieldType: prop.fieldType,
        }),
      );
    });
  }

  /**
   * Fetch owners
   */
  protected async fetchOwners(): Promise<
    Array<{ label: string; value: string; email?: string }>
  > {
    return this.useHubspot(async (client) => {
      const response = await client.get('/crm/v3/owners');
      return response.data.results.map((owner: HubspotOwner) => ({
        label:
          `${owner.firstName || ''} ${owner.lastName || ''}`.trim() ||
          owner.email,
        value: owner.id,
        email: owner.email,
      }));
    });
  }

  /**
   * Fetch pipelines
   */
  protected async fetchPipelines(): Promise<
    Array<{ label: string; value: string }>
  > {
    return this.useHubspot(async (client) => {
      const objectType = this.getObjectType();
      const pipelineObjectType =
        objectType === CrmObjectType.TICKETS ? 'tickets' : 'deals';
      const response = await client.get(
        `/crm/v3/pipelines/${pipelineObjectType}`,
      );
      return response.data.results.map((pipeline: HubspotPipeline) => ({
        label: pipeline.label,
        value: pipeline.id,
      }));
    });
  }

  /**
   * Fetch pipeline stages based on selected pipeline
   */
  protected async fetchPipelineStages(): Promise<
    Array<{ label: string; value: string }>
  > {
    const config = this.config as CrmObjectNodeConfig & { pipeline?: string };
    if (!config.pipeline) {
      return [];
    }

    return this.useHubspot(async (client) => {
      const objectType = this.getObjectType();
      const pipelineObjectType =
        objectType === CrmObjectType.TICKETS ? 'tickets' : 'deals';
      const response = await client.get(
        `/crm/v3/pipelines/${pipelineObjectType}/${config.pipeline}`,
      );
      return response.data.stages.map(
        (stage: { label: string; id: string }) => ({
          label: stage.label,
          value: stage.id,
        }),
      );
    });
  }

  /**
   * Fetch contact lists
   */
  protected async fetchLists(): Promise<
    Array<{ label: string; value: string }>
  > {
    return this.useHubspot(async (client) => {
      const response = await client.get('/contacts/v1/lists', {
        params: { count: 250 },
      });
      return response.data.lists.map(
        (list: { name: string; listId: number }) => ({
          label: list.name,
          value: String(list.listId),
        }),
      );
    });
  }

  /**
   * Create a CRM record
   */
  protected async createRecord(
    properties: Record<string, unknown>,
  ): Promise<HubspotCrmObject> {
    return this.useHubspot(async (client) => {
      const response = await client.post(this.getApiEndpoint(), { properties });
      return response.data;
    });
  }

  /**
   * Get a CRM record by ID
   */
  protected async getRecord(
    recordId: string,
    properties?: string[],
  ): Promise<HubspotCrmObject> {
    return this.useHubspot(async (client) => {
      const params: Record<string, string> = {};
      if (properties?.length) {
        params.properties = properties.join(',');
      }
      const response = await client.get(
        `${this.getApiEndpoint()}/${recordId}`,
        { params },
      );
      return response.data;
    });
  }

  /**
   * Update a CRM record
   */
  protected async updateRecord(
    recordId: string,
    properties: Record<string, unknown>,
  ): Promise<HubspotCrmObject> {
    return this.useHubspot(async (client) => {
      const response = await client.patch(
        `${this.getApiEndpoint()}/${recordId}`,
        { properties },
      );
      return response.data;
    });
  }

  /**
   * Delete a CRM record
   */
  protected async deleteRecord(recordId: string): Promise<void> {
    return this.useHubspot(async (client) => {
      await client.delete(`${this.getApiEndpoint()}/${recordId}`);
    });
  }

  /**
   * Search CRM records
   */
  protected async searchRecords(
    filterGroups?: FilterGroup[],
    properties?: string[],
    limit = 100,
    after?: string,
  ): Promise<HubspotSearchResponse> {
    return this.useHubspot(async (client) => {
      const body: Record<string, unknown> = {
        properties: properties || this.getDefaultProperties(),
        limit,
      };

      if (filterGroups?.length) {
        body.filterGroups = filterGroups;
      }

      if (after) {
        body.after = after;
      }

      const response = await client.post(
        `${this.getApiEndpoint()}/search`,
        body,
      );
      return response.data;
    });
  }

  /**
   * Get common form field for record ID
   */
  protected getRecordIdFormField(label: string): FormBuilderElement {
    return {
      type: FormBuilderInputType.WorkflowInput,
      label: `${label} ID`,
      model: 'config.recordId',
      placeholder: `Enter the ${label} ID`,
      validators: [
        {
          type: FormBuilderValidatorType.Required,
          message: `${label} ID is required`,
        },
      ],
    };
  }

  /**
   * Get form field for selecting properties to return
   */
  protected getPropertiesSelectFormField(): FormBuilderElement {
    return {
      type: FormBuilderInputType.Select,
      selectMode: 'multiple',
      label: 'Properties to Return',
      model: 'config.properties',
      fetchOptionsKey: 'properties',
      dependsOn: 'config.authIntegrationId',
      placeholder: 'Select properties (leave empty for defaults)',
      helpText: 'Select which properties to include in the response',
    };
  }

  /**
   * Get form fields for search filters
   */
  protected getSearchFilterFormFields(): FormBuilderElement[] {
    return [
      {
        type: FormBuilderInputType.KeyValue,
        label: 'Search Filters',
        model: 'config.filters',
        keyLabel: 'Property',
        valueLabel: 'Value',
        placeholder: 'Add filter',
        helpText: 'Filter results by property values (uses equals operator)',
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Limit',
        model: 'config.limit',
        defaultValue: 100,
        helpText: 'Maximum number of results to return (max 100)',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More Options',
        groupDefaultCollapsed: true,
      },
    ];
  }

  /**
   * Convert simple key-value filters to HubSpot filter groups
   */
  protected convertFiltersToFilterGroups(
    filters: Record<string, string>,
  ): FilterGroup[] {
    if (!filters || Object.keys(filters).length === 0) {
      return [];
    }

    const filterArray = Object.entries(filters).map(([key, value]) => ({
      propertyName: key,
      operator: 'EQ',
      value,
    }));

    return [{ filters: filterArray }];
  }

  /**
   * Clean properties by removing undefined/null values
   */
  protected cleanProperties(
    properties: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(properties).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      ),
    );
  }
}
