import type {
  BaseType,
  ColumnType,
  CommentType,
  NcRequest,
  TableType,
  UserType,
} from 'nocodb-sdk';

enum MailEvent {
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_UPDATE = 'COMMENT_UPDATE',
  ROW_USER_MENTION = 'ROW_USER_MENTION',
}

interface CommentPayload {
  base: BaseType;
  model: TableType;
  user: UserType;
  comment: CommentType;
  rowId: string;
  req: NcRequest;
}

interface RowMentionPayload {
  model: TableType;
  rowId: string;
  user: UserType;
  column: ColumnType;
  req: NcRequest;
  mentions: string[];
}

type MailParams =
  | {
      mailEvent: MailEvent.COMMENT_CREATE | MailEvent.COMMENT_UPDATE;
      payload: CommentPayload;
    }
  | {
      mailEvent: MailEvent.ROW_USER_MENTION;
      payload: RowMentionPayload;
    };

export { MailEvent, CommentPayload, RowMentionPayload, MailParams };
