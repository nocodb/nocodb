import { AppEvents } from '~/lib/enums';

/**
 * Values stored in `nc_notifications.type`. Most are `AppEvents`, but the
 * comment surfaces predate that and store their own literals — the frontend
 * notification list branches on these exact strings.
 */
export type NotificationKind =
  | AppEvents
  | 'mention'
  | 'comment'
  | 'doc_mention';
