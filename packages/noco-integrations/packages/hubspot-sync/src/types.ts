// ============================================
// HubSpot API Response Types
// ============================================

/**
 * Base HubSpot API Response
 */
interface HubSpotPaging {
  next?: {
    after: string;
    link: string;
  };
}

interface HubSpotApiResponse<T> {
  results: T[];
  paging?: HubSpotPaging;
}

/**
 * Address Structure
 */
interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

// ============================================
// Raw HubSpot API Response Types
// ============================================

/**
 * Raw Company (Account) from HubSpot API
 */
interface HubSpotCompanyProperties {
  name?: string;
  description?: string;
  industry?: string;
  website?: string;
  numberofemployees?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  hs_lastmodifieddate?: string;
  hubspot_owner_id?: string;
  createdate?: string;
  hs_object_id?: string;
  domain?: string;
  [key: string]: any; // For custom properties
}

interface HubSpotCompany {
  id: string;
  properties: HubSpotCompanyProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

/**
 * Raw Contact from HubSpot API
 */
interface HubSpotContactProperties {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  mobilephone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  hs_object_id?: string;
  associatedcompanyid?: string;
  hubspot_owner_id?: string;
  lastmodifieddate?: string;
  notes_last_updated?: string;
  createdate?: string;
  jobtitle?: string;
  lifecyclestage?: string;
  [key: string]: any; // For custom properties
}

interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

/**
 * Association Response
 */
interface HubSpotAssociation {
  id: string;
  type: string;
}

interface HubSpotAssociationResponse {
  results: HubSpotAssociation[];
  paging?: HubSpotPaging;
}

// ============================================
// Transformed/Normalized Types (for your app)
// ============================================

/**
 * Normalized Account (Company) Type
 */
interface Account {
  id: string;
  name?: string;
  description?: string;
  industry?: string;
  website?: string;
  numberOfEmployees?: number;
  address?: Address;
  phone?: string;
  lastActivityAt?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  domain?: string;
  rawData?: HubSpotCompany;
}

/**
 * Normalized Contact Type
 */
interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: Address;
  accountId?: string;
  associatedAccountIds?: string[];
  ownerId?: string;
  lastActivityAt?: string;
  createdAt?: string;
  updatedAt?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  rawData?: HubSpotContact;
}

/**
 * Batch Request/Response Types
 */
interface BatchReadInput {
  id: string;
  properties?: string[];
}

interface BatchReadRequest {
  inputs: BatchReadInput[];
}

interface BatchReadResponse<T> {
  status: string;
  results: T[];
  errors?: Array<{
    status: string;
    message: string;
    category: string;
  }>;
}

/**
 * Search Request Types
 */
interface FilterGroup {
  filters: Array<{
    propertyName: string;
    operator:
      | 'EQ'
      | 'NEQ'
      | 'LT'
      | 'LTE'
      | 'GT'
      | 'GTE'
      | 'CONTAINS'
      | 'IN'
      | 'HAS_PROPERTY'
      | 'NOT_HAS_PROPERTY';
    value?: string | number | boolean;
  }>;
}

interface SearchRequest {
  filterGroups?: FilterGroup[];
  sorts?: Array<{
    propertyName: string;
    direction: 'ASCENDING' | 'DESCENDING';
  }>;
  properties?: string[];
  limit?: number;
  after?: string;
}

interface SearchResponse<T> {
  total: number;
  results: T[];
  paging?: HubSpotPaging;
}

// ============================================
// Data Pull Response Types
// ============================================

/**
 * Complete data pull response
 */
interface HubSpotDataPull {
  accounts: Account[];
  contacts: Contact[];
  pulledAt: string;
  summary: {
    totalAccounts: number;
    totalContacts: number;
    accountsWithContacts: number;
    contactsWithoutAccounts: number;
  };
}

/**
 * Error Response
 */
interface HubSpotError {
  status: string;
  message: string;
  correlationId?: string;
  category?: string;
  subCategory?: string;
  errors?: Array<{
    message: string;
    in?: string;
  }>;
}

/**
 * API Configuration
 */
interface HubSpotConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Pagination Options
 */
interface PaginationOptions {
  limit?: number;
  after?: string;
  properties?: string[];
}

/**
 * Association Types
 */
type AssociationType =
  | 'contact_to_company'
  | 'company_to_contact'
  | 'contact_to_deal'
  | 'deal_to_contact'
  | 'company_to_deal'
  | 'deal_to_company';

interface AssociationRequest {
  from: {
    id: string;
  };
  to: {
    id: string;
  };
  type: AssociationType;
}

// ============================================
// Export all types
// ============================================

export type {
  // API Response Types
  HubSpotPaging,
  HubSpotApiResponse,
  HubSpotError,

  // Raw HubSpot Types
  HubSpotCompany,
  HubSpotCompanyProperties,
  HubSpotContact,
  HubSpotContactProperties,
  HubSpotAssociation,
  HubSpotAssociationResponse,

  // Normalized Types
  Account,
  Contact,
  Address,

  // Batch Types
  BatchReadInput,
  BatchReadRequest,
  BatchReadResponse,

  // Search Types
  SearchRequest,
  SearchResponse,
  FilterGroup,

  // Data Pull Types
  HubSpotDataPull,

  // Configuration
  HubSpotConfig,
  PaginationOptions,

  // Associations
  AssociationType,
  AssociationRequest,
};

// ============================================
// Type Guards
// ============================================

export function isHubSpotError(error: any): error is HubSpotError {
  return (
    error &&
    typeof error.status === 'string' &&
    typeof error.message === 'string'
  );
}

export function hasAssociations(
  contact: Contact,
): contact is Contact & { associatedAccountIds: string[] } {
  return Array.isArray(contact.associatedAccountIds);
}

// ============================================
// Constants
// ============================================

export const HUBSPOT_OBJECTS = {
  CONTACT: 'contacts',
  COMPANY: 'companies',
  DEAL: 'deals',
  TICKET: 'tickets',
  ENGAGEMENT: 'engagements',
  NOTE: 'notes',
  TASK: 'tasks',
} as const;

export const PROPERTY_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  DATETIME: 'datetime',
  ENUMERATION: 'enumeration',
  BOOL: 'bool',
} as const;
