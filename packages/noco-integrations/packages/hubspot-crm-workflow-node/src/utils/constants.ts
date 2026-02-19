export enum CrmObjectType {
  CONTACTS = 'contacts',
  COMPANIES = 'companies',
  DEALS = 'deals',
  TICKETS = 'tickets',
  PRODUCTS = 'products',
  LINE_ITEMS = 'line_items',
  QUOTES = 'quotes',
}

export const CRM_OBJECT_LABELS: Record<CrmObjectType, string> = {
  [CrmObjectType.CONTACTS]: 'Contact',
  [CrmObjectType.COMPANIES]: 'Company',
  [CrmObjectType.DEALS]: 'Deal',
  [CrmObjectType.TICKETS]: 'Ticket',
  [CrmObjectType.PRODUCTS]: 'Product',
  [CrmObjectType.LINE_ITEMS]: 'Line Item',
  [CrmObjectType.QUOTES]: 'Quote',
};

export const CRM_OBJECT_PLURAL_LABELS: Record<CrmObjectType, string> = {
  [CrmObjectType.CONTACTS]: 'Contacts',
  [CrmObjectType.COMPANIES]: 'Companies',
  [CrmObjectType.DEALS]: 'Deals',
  [CrmObjectType.TICKETS]: 'Tickets',
  [CrmObjectType.PRODUCTS]: 'Products',
  [CrmObjectType.LINE_ITEMS]: 'Line Items',
  [CrmObjectType.QUOTES]: 'Quotes',
};

export const DEFAULT_PROPERTIES: Record<CrmObjectType, string[]> = {
  [CrmObjectType.CONTACTS]: [
    'email',
    'firstname',
    'lastname',
    'phone',
    'company',
    'jobtitle',
    'lifecyclestage',
    'hs_lead_status',
  ],
  [CrmObjectType.COMPANIES]: [
    'name',
    'domain',
    'industry',
    'phone',
    'city',
    'state',
    'country',
    'numberofemployees',
    'annualrevenue',
  ],
  [CrmObjectType.DEALS]: [
    'dealname',
    'amount',
    'dealstage',
    'pipeline',
    'closedate',
    'hubspot_owner_id',
  ],
  [CrmObjectType.TICKETS]: [
    'subject',
    'content',
    'hs_pipeline',
    'hs_pipeline_stage',
    'hs_ticket_priority',
    'hubspot_owner_id',
  ],
  [CrmObjectType.PRODUCTS]: [
    'name',
    'description',
    'price',
    'hs_sku',
    'hs_cost_of_goods_sold',
  ],
  [CrmObjectType.LINE_ITEMS]: [
    'name',
    'quantity',
    'price',
    'amount',
    'hs_product_id',
  ],
  [CrmObjectType.QUOTES]: [
    'hs_title',
    'hs_expiration_date',
    'hs_status',
    'hs_quote_amount',
  ],
};

export const ASSOCIATION_TYPES = {
  CONTACT_TO_COMPANY: 'contact_to_company',
  CONTACT_TO_DEAL: 'contact_to_deal',
  CONTACT_TO_TICKET: 'contact_to_ticket',
  COMPANY_TO_CONTACT: 'company_to_contact',
  COMPANY_TO_DEAL: 'company_to_deal',
  DEAL_TO_CONTACT: 'deal_to_contact',
  DEAL_TO_COMPANY: 'deal_to_company',
  DEAL_TO_LINE_ITEM: 'deal_to_line_item',
  TICKET_TO_CONTACT: 'ticket_to_contact',
  TICKET_TO_COMPANY: 'ticket_to_company',
} as const;

export const SEARCH_FILTER_OPERATORS = [
  { label: 'Equal to', value: 'EQ' },
  { label: 'Not equal to', value: 'NEQ' },
  { label: 'Less than', value: 'LT' },
  { label: 'Less than or equal to', value: 'LTE' },
  { label: 'Greater than', value: 'GT' },
  { label: 'Greater than or equal to', value: 'GTE' },
  { label: 'Contains', value: 'CONTAINS_TOKEN' },
  { label: 'Does not contain', value: 'NOT_CONTAINS_TOKEN' },
  { label: 'Is known', value: 'HAS_PROPERTY' },
  { label: 'Is unknown', value: 'NOT_HAS_PROPERTY' },
  { label: 'In list', value: 'IN' },
  { label: 'Not in list', value: 'NOT_IN' },
];

export const ENGAGEMENT_TYPES = [
  { label: 'Note', value: 'NOTE' },
  { label: 'Email', value: 'EMAIL' },
  { label: 'Task', value: 'TASK' },
  { label: 'Meeting', value: 'MEETING' },
  { label: 'Call', value: 'CALL' },
];
