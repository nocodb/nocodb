import { UITypes, TARGET_TABLES } from 'nocodb-sdk';
import { SyncSchema, SyncRecord, SyncValue } from './types';

export interface TicketingTicketRecord extends SyncRecord {
  Name: SyncValue<string>;
  Description: SyncValue<string>;
  'Due Date': SyncValue<string>;
  Priority: SyncValue<string>;
  Status: SyncValue<string>;
  Tags: SyncValue<string>;
  'Ticket Type': SyncValue<string>;
  'Ticket Url': SyncValue<string>;
  'Is Active': SyncValue<boolean>;
  'Completed At': SyncValue<string>;
  'Ticket Number': SyncValue<string>;
}

export interface TicketingUserRecord extends SyncRecord {
  Name: SyncValue<string>;
  Email: SyncValue<string>;
}

export const SCHEMA_TICKETING: SyncSchema = {
  [TARGET_TABLES.TICKETING_TICKET]: {
    title: 'Ticket',
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText },
      {
        title: 'Description',
        uidt: UITypes.LongText,
        meta: { richMode: true },
      },
      { title: 'Ticket Number', uidt: UITypes.SingleLineText },
      { title: 'Due Date', uidt: UITypes.Date },
      { title: 'Priority', uidt: UITypes.SingleSelect },
      { title: 'Status', uidt: UITypes.SingleSelect },
      { title: 'Tags', uidt: UITypes.MultiSelect },
      { title: 'Ticket Type', uidt: UITypes.SingleSelect },
      { title: 'Ticket Url', uidt: UITypes.URL },
      { title: 'Is Active', uidt: UITypes.Checkbox },
      { title: 'Completed At', uidt: UITypes.DateTime },
    ],
    relations: [],
  },
  [TARGET_TABLES.TICKETING_USER]: {
    title: 'User',
    columns: [
      { title: 'Email', uidt: UITypes.Email },
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'Url', uidt: UITypes.URL },
    ],
    relations: [
      {
        columnTitle: 'Created Tickets',
        relatedTable: TARGET_TABLES.TICKETING_TICKET,
        relatedTableColumnTitle: 'Creator',
      },
      {
        columnTitle: 'Assigned Tickets',
        relatedTable: TARGET_TABLES.TICKETING_TICKET,
        relatedTableColumnTitle: 'Assignees',
      },
    ],
  },
  [TARGET_TABLES.TICKETING_COMMENT]: {
    title: 'Comment',
    columns: [
      { title: 'Title', uidt: UITypes.SingleLineText },
      { title: 'Body', uidt: UITypes.LongText, meta: { richMode: true } },
      { title: 'Url', uidt: UITypes.URL },
    ],
    relations: [
      {
        columnTitle: 'Ticket',
        relatedTable: TARGET_TABLES.TICKETING_TICKET,
        relatedTableColumnTitle: 'Comments',
      },
      {
        columnTitle: 'Created By',
        relatedTable: TARGET_TABLES.TICKETING_USER,
        relatedTableColumnTitle: 'Created By',
      },
    ],
  },
};
