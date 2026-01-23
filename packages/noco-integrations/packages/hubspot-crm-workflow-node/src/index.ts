import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';

import {
  CreateContactNode,
  FindContactsNode,
  GetContactNode,
  UpdateContactNode,
} from './nodes/crm/contact';
import {
  CreateCompanyNode,
  FindCompaniesNode,
  GetCompanyNode,
  UpdateCompanyNode,
} from './nodes/crm/company';
import {
  CreateDealNode,
  FindDealsNode,
  GetDealNode,
  UpdateDealNode,
} from './nodes/crm/deal';

export const entries: IntegrationEntry[] = [
  // Contact Nodes
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.contact_create',
    wrapper: CreateContactNode,
    form: [],
    manifest: { ...manifest, title: 'Create Contact', order: 1 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.contact_get',
    wrapper: GetContactNode,
    form: [],
    manifest: { ...manifest, title: 'Get Contact', order: 2 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.contact_update',
    wrapper: UpdateContactNode,
    form: [],
    manifest: { ...manifest, title: 'Update Contact', order: 3 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.contact_find',
    wrapper: FindContactsNode,
    form: [],
    manifest: { ...manifest, title: 'Find Contacts', order: 4 },
    packageManifest: manifest,
  },
  // Company Nodes
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.company_create',
    wrapper: CreateCompanyNode,
    form: [],
    manifest: { ...manifest, title: 'Create Company', order: 5 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.company_get',
    wrapper: GetCompanyNode,
    form: [],
    manifest: { ...manifest, title: 'Get Company', order: 6 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.company_update',
    wrapper: UpdateCompanyNode,
    form: [],
    manifest: { ...manifest, title: 'Update Company', order: 7 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.company_find',
    wrapper: FindCompaniesNode,
    form: [],
    manifest: { ...manifest, title: 'Find Companies', order: 8 },
    packageManifest: manifest,
  },
  // Deal Nodes
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.deal_create',
    wrapper: CreateDealNode,
    form: [],
    manifest: { ...manifest, title: 'Create Deal', order: 9 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.deal_get',
    wrapper: GetDealNode,
    form: [],
    manifest: { ...manifest, title: 'Get Deal', order: 10 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.deal_update',
    wrapper: UpdateDealNode,
    form: [],
    manifest: { ...manifest, title: 'Update Deal', order: 11 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'hubspot_crm.action.deal_find',
    wrapper: FindDealsNode,
    form: [],
    manifest: { ...manifest, title: 'Find Deals', order: 12 },
    packageManifest: manifest,
  },
];

export default entries;
