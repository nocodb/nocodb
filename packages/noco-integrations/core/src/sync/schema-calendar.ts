import { UITypes, TARGET_TABLES, TARGET_TABLES_META } from 'nocodb-sdk';
import { SyncSchema } from './types';

export const SCHEMA_CALENDAR: SyncSchema = {
  [TARGET_TABLES.CALENDAR_EVENT]: {
    title: TARGET_TABLES_META.calendar_event.label,
    columns: [
      { title: 'Title', uidt: UITypes.SingleLineText, pv: true },
      { title: 'Start', uidt: UITypes.DateTime },
      { title: 'End', uidt: UITypes.DateTime },
      { title: 'All Day', uidt: UITypes.Checkbox },
      { title: 'Recurring Event', uidt: UITypes.Checkbox },
      { title: 'Recurring Event ID', uidt: UITypes.SingleLineText },
      {
        title: 'Status',
        uidt: UITypes.SingleSelect,
        colOptions: {
          options: [
            { title: 'confirmed' },
            { title: 'tentative' },
            { title: 'cancelled' },
          ],
        },
      },
      {
        title: 'Show as',
        uidt: UITypes.SingleSelect,
        colOptions: {
          options: [{ title: 'Busy' }, { title: 'Free' }],
        },
      },
      {
        title: 'Visibility',
        uidt: UITypes.SingleSelect,
        colOptions: {
          options: [
            { title: 'default' },
            { title: 'public' },
            { title: 'private' },
            { title: 'confidential' },
          ],
        },
      },
      {
        title: 'Event Type',
        uidt: UITypes.SingleSelect,
        colOptions: {
          options: [
            { title: 'default' },
            { title: 'birthday' },
            { title: 'focusTime' },
            { title: 'fromGmail' },
            { title: 'outOfOffice' },
            { title: 'workingLocation' },
          ],
        },
      },
      { title: 'Location', uidt: UITypes.SingleLineText },
      { title: 'Description', uidt: UITypes.LongText },
      { title: 'Creator', uidt: UITypes.Email },
      { title: 'Organizer', uidt: UITypes.Email },
      { title: 'Attendees', uidt: UITypes.SingleLineText },
      { title: 'Attendee Count', uidt: UITypes.Number },
      {
        title: 'My Response',
        uidt: UITypes.SingleSelect,
        colOptions: {
          options: [
            { title: 'needsAction' },
            { title: 'accepted' },
            { title: 'declined' },
            { title: 'tentative' },
          ],
        },
      },
      { title: 'Attachments', uidt: UITypes.LongText },
      { title: 'Created', uidt: UITypes.DateTime },
      { title: 'Updated', uidt: UITypes.DateTime },
      { title: 'Event ID', uidt: UITypes.SingleLineText },
      { title: 'iCalUID', uidt: UITypes.SingleLineText },
      { title: 'Event Link', uidt: UITypes.URL },
      { title: 'Meeting Link', uidt: UITypes.URL },
      { title: 'Meeting Provider', uidt: UITypes.SingleLineText },
      { title: 'Color', uidt: UITypes.SingleLineText },
    ],
    relations: [],
  },
};
