import ChatMessageCE from 'src/models/ChatMessage';
import type { ChatAttachmentType, ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { PresignedUrl } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

const JSON_FIELDS = ['parts', 'files'];

export default class ChatMessage
  extends ChatMessageCE
  implements ChatMessageType
{
  id?: string;
  fk_session_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  role: ChatMessageType['role'];
  content?: string | null;
  parts?: ChatMessageType['parts'];
  files?: ChatAttachmentType[];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  bt_span_id?: string | null;
  created_at?: string;

  constructor(data: ChatMessage) {
    super(data);
    Object.assign(this, data);
  }

  protected static async presignFiles(
    message: ChatMessage,
    ncMeta = Noco.ncMeta,
  ) {
    if (message.files?.length) {
      await Promise.all(
        message.files.map((file) =>
          PresignedUrl.signAttachment({ attachment: file }, ncMeta).catch(
            () => {},
          ),
        ),
      );
    }
  }

  public static async get(
    context: NcContext,
    messageId: string,
    sessionId?: string,
    ncMeta: any = Noco.ncChatMessages,
  ) {
    if (!messageId) {
      return null;
    }

    const condition: Record<string, string> = { id: messageId };
    if (sessionId) {
      condition.fk_session_id = sessionId;
    }

    let message = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      condition,
    );

    if (message) {
      message = prepareForResponse(message, JSON_FIELDS);
    }

    const msg = message && new ChatMessage(message);
    if (msg) {
      await this.presignFiles(msg, ncMeta);
    }
    return msg;
  }

  public static async list(
    context: NcContext,
    {
      sessionId,
      limit,
      offset,
    }: {
      sessionId: string;
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncChatMessages,
  ) {
    const messagesList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      {
        condition: {
          fk_session_id: sessionId,
        },
        orderBy: {
          created_at: 'asc',
        },
        ...(limit && { limit }),
        ...(offset && { offset }),
      },
    );

    for (const msg of messagesList) {
      prepareForResponse(msg, JSON_FIELDS);
    }

    const messages = messagesList.map((m) => new ChatMessage(m));

    await Promise.all(messages.map((m) => this.presignFiles(m)));

    return messages;
  }

  static async insert(
    context: NcContext,
    message: Partial<ChatMessage>,
    ncMeta = Noco.ncChatMessages,
  ) {
    const insertObj = prepareForDb(
      extractProps(message, [
        'id',
        'fk_session_id',
        'role',
        'content',
        'parts',
        'files',
        'model',
        'input_tokens',
        'output_tokens',
        'bt_span_id',
      ]),
      JSON_FIELDS,
    );

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      insertObj,
    );

    return ChatMessage.get(context, id, undefined, ncMeta);
  }

  static async update(
    context: NcContext,
    messageId: string,
    data: Partial<Pick<ChatMessage, 'parts' | 'content'>>,
    ncMeta = Noco.ncChatMessages,
  ) {
    const updateObj = prepareForDb(
      extractProps(data, ['parts', 'content']),
      JSON_FIELDS,
    );

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      updateObj,
      { id: messageId },
    );

    return ChatMessage.get(context, messageId, undefined, ncMeta);
  }

  static async delete(
    context: NcContext,
    messageId: string,
    ncMeta = Noco.ncChatMessages,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      {
        id: messageId,
      },
    );
  }

  static async deleteBySessionId(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncChatMessages,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      { fk_session_id: sessionId },
    );
  }

  static async countByWorkspaceAndMonth(
    _context: NcContext,
    workspaceId: string,
    ncMeta = Noco.ncChatMessages,
  ) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await ncMeta
      .knexConnection(MetaTable.CHAT_MESSAGES)
      .where('fk_workspace_id', workspaceId)
      .where('role', 'user')
      .where('created_at', '>=', startOfMonth.toISOString())
      .count('id as count')
      .first();

    return Number(result?.count || 0);
  }
}
