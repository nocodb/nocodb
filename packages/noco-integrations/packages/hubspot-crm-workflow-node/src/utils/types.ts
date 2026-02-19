import type { WorkflowNodeConfig } from '@noco-integrations/core';
import type { CrmObjectType } from './constants';

export interface HubspotNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
}

export interface SearchFilter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

export interface FilterGroup {
  filters: SearchFilter[];
}

// Generic CRM Object configs
export interface GenericCrmConfig extends HubspotNodeConfig {
  objectType: CrmObjectType | string;
}

// API Response types
export interface HubspotCrmObject {
  id: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubspotSearchResponse {
  total: number;
  results: HubspotCrmObject[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

export interface HubspotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubspotPipeline {
  id: string;
  label: string;
  displayOrder: number;
  stages: HubspotPipelineStage[];
}

export interface HubspotPipelineStage {
  id: string;
  label: string;
  displayOrder: number;
  metadata: Record<string, unknown>;
}
