import ChatMessageCE from 'src/models/ChatMessage';
import type { ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

const JSON_FIELDS = ['parts'];

export default class ChatMessage
  extends ChatMessageCE
  implements ChatMessageType
{
  id?: string;
  fk_session_id: string;
  role: ChatMessageType['role'];
  content?: string | null;
  parts?: ChatMessageType['parts'];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;

  constructor(data: ChatMessage) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    messageId: string,
    ncMeta = Noco.ncChatMessages,
  ) {
    if (!messageId) {
      return null;
    }

    let message = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      {
        id: messageId,
      },
    );

    if (message) {
      message = prepareForResponse(message, JSON_FIELDS);
    }

    return message && new ChatMessage(message);
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

    return messagesList.map((m) => new ChatMessage(m));
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
        'model',
        'input_tokens',
        'output_tokens',
      ]),
      JSON_FIELDS,
    );

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      insertObj,
    );

    return ChatMessage.get(context, id, ncMeta);
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

    return ChatMessage.get(context, messageId, ncMeta);
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
