import { UITypes, TARGET_TABLES, TARGET_TABLES_META } from 'nocodb-sdk';
import { SyncSchema, SyncRecord, SyncValue } from './types';

export const SCHEMA_CRM: SyncSchema = {
  [TARGET_TABLES.CRM_ACCOUNT]: {
    title: TARGET_TABLES_META[TARGET_TABLES.CRM_ACCOUNT].label,
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Description', uidt: UITypes.SingleLineText },
      { title: 'Industry', uidt: UITypes.SingleSelect },
      { title: 'Website', uidt: UITypes.URL },
      { title: 'Number Of Employees', uidt: UITypes.Number },
      { title: 'Addresses', uidt: UITypes.SingleLineText },
      { title: 'Phone Numbers', uidt: UITypes.PhoneNumber },
      { title: 'Remote Fields', uidt: UITypes.JSON },
    ],
    relations: [
      {
        columnTitle: 'Owner',
        relatedTable: TARGET_TABLES.CRM_USER,
        relatedTableColumnTitle: 'Accounts'
      }
    ],
  },

  // [TARGET_TABLES.CRM_ASSOCIATION]: {
  //   title: TARGET_TABLES_META.crm_association.label,
  //   columns: [
  //     { title: 'Source Object', uidt: UITypes.SingleLineText },
  //     { title: 'Target Object', uidt: UITypes.SingleLineText },
  //     { title: 'Association Type', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [],
  // },

  // [TARGET_TABLES.CRM_ASSOCIATION_TYPE]: {
  //   title: TARGET_TABLES_META.crm_association_type.label,
  //   columns: [
  //     { title: 'Source Object Class', uidt: UITypes.SingleLineText },
  //     { title: 'Target Object Classes', uidt: UITypes.SingleLineText },
  //     { title: 'Remote Key Name', uidt: UITypes.SingleLineText },
  //     { title: 'Display Name', uidt: UITypes.SingleLineText },
  //     { title: 'Cardinality', uidt: UITypes.SingleLineText },
  //     { title: 'Is Required', uidt: UITypes.Checkbox },
  //   ],
  //   relations: [],
  // },

  [TARGET_TABLES.CRM_CONTACT]: {
    title: TARGET_TABLES_META[TARGET_TABLES.CRM_CONTACT].label,
    columns: [
      { title: 'First Name', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Last Name', uidt: UITypes.SingleLineText },
      { title: 'Addresses', uidt: UITypes.SingleLineText },
      { title: 'Email Addresses', uidt: UITypes.Email },
      { title: 'Phone Numbers', uidt: UITypes.PhoneNumber },
      { title: 'Last Activity At', uidt: UITypes.Date },
      { title: 'Remote Fields', uidt: UITypes.JSON },
    ],
    relations: [
      {
        columnTitle: 'Account',
        relatedTable: TARGET_TABLES.CRM_ACCOUNT,
        relatedTableColumnTitle: 'Contacts'
      },
      {
        columnTitle: 'Owner',
        relatedTable: TARGET_TABLES.CRM_USER,
        relatedTableColumnTitle: 'Contacts'
      }
    ],
  },

  // [TARGET_TABLES.CRM_ENGAGEMENT]: {
  //   title: TARGET_TABLES_META.crm_engagement.label,
  //   columns: [
  //     { title: 'Owner', uidt: UITypes.SingleLineText },
  //     { title: 'Content', uidt: UITypes.LongText },
  //     { title: 'Subject', uidt: UITypes.SingleLineText },
  //     { title: 'Direction', uidt: UITypes.SingleSelect },
  //     { title: 'Engagement Type', uidt: UITypes.SingleSelect },
  //     { title: 'Start Time', uidt: UITypes.DateTime },
  //     { title: 'End Time', uidt: UITypes.DateTime },
  //     { title: 'Contacts', uidt: UITypes.SingleLineText },
  //     { title: 'Remote Fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Account',
  //       relatedTable: TARGET_TABLES.CRM_ACCOUNT,
  //       relatedTableColumnTitle: 'Engagements'
  //     }
  //   ],
  // },

  // [TARGET_TABLES.CRM_ENGAGEMENT_TYPE]: {
  //   title: TARGET_TABLES_META.crm_engagement_type.label,
  //   columns: [
  //     { title: 'Name', uidt: UITypes.SingleLineText, pv: true },
  //     { title: 'Activity Type', uidt: UITypes.SingleSelect },
  //     { title: 'Remote Fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [],
  // },

  // FIXME: cannot access lead feature on hubspot atm
  // [TARGET_TABLES.CRM_LEAD]: {
  //   title: TARGET_TABLES_META[TARGET_TABLES.CRM_LEAD].label,
  //   columns: [
  //     { title: 'Owner', uidt: UITypes.SingleLineText },
  //     { title: 'Lead Source', uidt: UITypes.SingleSelect },
  //     { title: 'Title', uidt: UITypes.SingleLineText },
  //     { title: 'Company', uidt: UITypes.SingleLineText },
  //     { title: 'First Name', uidt: UITypes.SingleLineText },
  //     { title: 'Last Name', uidt: UITypes.SingleLineText },
  //     { title: 'Addresses', uidt: UITypes.SingleLineText },
  //     { title: 'Email Addresses', uidt: UITypes.Email },
  //     { title: 'Phone Numbers', uidt: UITypes.PhoneNumber },
  //     { title: 'Converted Date', uidt: UITypes.DateTime },
  //     { title: 'Converted Contact', uidt: UITypes.SingleLineText },
  //     { title: 'Status', uidt: UITypes.SingleSelect },
  //     { title: 'Remote Fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Converted_Account',
  //       relatedTable: TARGET_TABLES.CRM_ACCOUNT,
  //       relatedTableColumnTitle: 'Leads'
  //     },
  //     {
  //       columnTitle: 'Converted_Contact',
  //       relatedTable: TARGET_TABLES.CRM_CONTACT,
  //       relatedTableColumnTitle: 'Leads'
  //     }
  //   ],
  // },

  // [TARGET_TABLES.CRM_NOTE]: {
  //   title: TARGET_TABLES_META.crm_note.label,
  //   columns: [
  //     { title: 'Content', uidt: UITypes.LongText, pv: true },
  //     { title: 'Owner', uidt: UITypes.SingleLineText },
  //     { title: 'Opportunity', uidt: UITypes.SingleLineText },
  //     { title: 'Remote Fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Account',
  //       relatedTable: TARGET_TABLES.CRM_ACCOUNT,
  //       relatedTableColumnTitle: 'Notes'
  //     },
  //     {
  //       columnTitle: 'Contacts',
  //       relatedTable: TARGET_TABLES.CRM_CONTACT,
  //       relatedTableColumnTitle: 'Notes'
  //     }
  //   ],
  // },

  // [TARGET_TABLES.CRM_OPPORTUNITY]: {
  //   title: TARGET_TABLES_META.crm_opportunity.label,
  //   columns: [
  //     { title: 'Name', uidt: UITypes.SingleLineText },
  //     { title: 'Description', uidt: UITypes.SingleLineText },
  //     { title: 'Amount', uidt: UITypes.Decimal },
  //     { title: 'Owner', uidt: UITypes.SingleLineText },
  //     { title: 'Status', uidt: UITypes.SingleSelect },
  //     { title: 'Last Activity At', uidt: UITypes.DateTime },
  //     { title: 'Close Date', uidt: UITypes.DateTime },
  //     { title: 'Remote Fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Stage',
  //       relatedTable: TARGET_TABLES.CRM_STAGE,
  //       relatedTableColumnTitle: 'Opportunities'
  //     },
  //     {
  //       columnTitle: 'Account',
  //       relatedTable: TARGET_TABLES.CRM_ACCOUNT,
  //       relatedTableColumnTitle: 'Opportunities'
  //     }
  //   ],
  // },

  // [TARGET_TABLES.CRM_TASK]: {
  //   title: TARGET_TABLES_META.crm_task.label,
  //   columns: [
  //     { title: 'Subject', uidt: UITypes.SingleLineText },
  //     { title: 'Content', uidt: UITypes.SingleLineText },
  //     { title: 'Owner', uidt: UITypes.SingleLineText },
  //     { title: 'Opportunity', uidt: UITypes.SingleLineText },
  //     { title: 'Contact', uidt: UITypes.SingleLineText },
  //     { title: 'Completed Date', uidt: UITypes.SingleLineText },
  //     { title: 'Due Date', uidt: UITypes.SingleLineText },
  //     { title: 'Status', uidt: UITypes.SingleSelect },
  //     { title: 'Remote Fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [
  //     {
  //       columnTitle: 'Account',
  //       relatedTable: TARGET_TABLES.CRM_ACCOUNT,
  //       relatedTableColumnTitle: 'Tasks'
  //     }
  //   ],
  // },

  [TARGET_TABLES.CRM_USER]: {
    title: TARGET_TABLES_META[TARGET_TABLES.CRM_USER].label,
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Email', uidt: UITypes.Email },
      { title: 'Is Active', uidt: UITypes.Checkbox },
      { title: 'Remote Fields', uidt: UITypes.JSON },
    ],
    relations: [],
  },
};

  // [TARGET_TABLES.CRM_CustomObject]: {
  //   title: TARGET_TABLES_META.crm_custom_object.label,
  //   columns: [
  //     { title: 'remote_id', uidt: UITypes.SingleLineText },
  //     { title: 'created_at', uidt: UITypes.SingleLineText },
  //     { title: 'modified_at', uidt: UITypes.SingleLineText },
  //     { title: 'object_class', uidt: UITypes.SingleLineText },
  //     { title: 'fields', uidt: UITypes.SingleLineText },
  //     { title: 'remote_fields', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [],
  // },

  // [TARGET_TABLES.CustomObjectClass]: {
  //   title: TARGET_TABLES_META.crm_custom_object_class.label,
  //   columns: [
  //     { title: 'remote_id', uidt: UITypes.SingleLineText },
  //     { title: 'created_at', uidt: UITypes.SingleLineText },
  //     { title: 'modified_at', uidt: UITypes.SingleLineText },
  //     { title: 'name', uidt: UITypes.SingleLineText },
  //     { title: 'description', uidt: UITypes.SingleLineText },
  //     { title: 'labels', uidt: UITypes.SingleLineText },
  //     { title: 'fields', uidt: UITypes.SingleLineText },
  //     { title: 'association_types', uidt: UITypes.SingleLineText },
  //   ],
  //   relations: [],
  // },
