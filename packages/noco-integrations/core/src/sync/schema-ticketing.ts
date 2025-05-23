import { UITypes } from 'nocodb-sdk';
import { TARGET_TABLES } from './common';
import { SyncSchema } from './types';

export const SCHEMA_TICKETING: SyncSchema = {
  [TARGET_TABLES.TICKETING_TICKET]: {
    title: 'Ticket',
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'Description', uidt: UITypes.LongText },
      { title: 'Due Date', uidt: UITypes.Date },
      { title: 'Priority', uidt: UITypes.SingleSelect },
      { title: 'Status', uidt: UITypes.SingleSelect },
      { title: 'Tags', uidt: UITypes.MultiSelect },
      { title: 'Ticket Type', uidt: UITypes.SingleSelect },
      { title: 'Ticket Url', uidt: UITypes.URL },
      { title: 'Is Active', uidt: UITypes.Checkbox },
      { title: 'Completed At', uidt: UITypes.DateTime },
    ],
    relations: [
      {
        type: 'hm',
        columnTitle: 'Subtickets',
        relatedTable: TARGET_TABLES.TICKETING_TICKET,
        relatedTableColumnTitle: 'Parent Ticket',
      },
    ],
  },
  [TARGET_TABLES.TICKETING_USER]: {
    title: 'User',
    columns: [
      { title: 'Email Address', uidt: UITypes.Email },
      { title: 'Name', uidt: UITypes.SingleLineText },
    ],
    relations: [
      {
        type: 'oo',
        columnTitle: 'Created Tickets',
        relatedTable: TARGET_TABLES.TICKETING_TICKET,
        relatedTableColumnTitle: 'Creator',
      },
      {
        type: 'mm',
        columnTitle: 'Assigned Tickets',
        relatedTable: TARGET_TABLES.TICKETING_TICKET,
        relatedTableColumnTitle: 'Assignees',
      },
    ],
  },
};
