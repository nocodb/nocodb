import ChatMessageCE from 'src/models/ChatMessage';
import type { ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
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
    ncMeta = Noco.ncMeta,
  ) {
    if (!messageId) {
      return null;
    }

    let message =
      messageId &&
      (await NocoCache.get(
        context,
        `${CacheScope.CHAT_MESSAGE}:${messageId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!message) {
      message = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.CHAT_MESSAGES,
        {
          id: messageId,
        },
      );

      if (message) {
        message = prepareForResponse(message, JSON_FIELDS);
        await NocoCache.set(
          context,
          `${CacheScope.CHAT_MESSAGE}:${message.id}`,
          message,
        );
      }
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
    ncMeta = Noco.ncMeta,
  ) {
    // Chat messages are append-only and frequently updated (approval flow, compaction).
    // Session list caching is intentionally bypassed here: after approval, continueAfterApproval
    // inserts a new message via appendToList which creates a partial cache list, causing
    // messageList to return incomplete data. Always fetch from DB for correctness.
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
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = prepareForDb(
      extractProps(message, [
        'id',
        'fk_session_id',
        'fk_workspace_id',
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
    ncMeta = Noco.ncMeta,
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

    // Evict stale entry — list cache is intentionally not used for messages,
    // so a plain del is sufficient (no parent list to walk up to).
    await NocoCache.del(context, `${CacheScope.CHAT_MESSAGE}:${messageId}`);

    return ChatMessage.get(context, messageId, ncMeta);
  }

  static async delete(
    context: NcContext,
    messageId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      {
        id: messageId,
      },
    );

    await NocoCache.del(context, `${CacheScope.CHAT_MESSAGE}:${messageId}`);
  }

  static async deleteBySessionId(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Fetch IDs first so we can bust the cache for each message
    const messages = await this.list(context, { sessionId }, ncMeta);

    // Bulk delete — contextCondition adds base_id/fk_workspace_id scoping automatically
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      { fk_session_id: sessionId },
    );

    // Evict all message cache entries in a single round trip
    await NocoCache.del(
      context,
      messages.map((m) => `${CacheScope.CHAT_MESSAGE}:${m.id}`),
    );
  }

  static async countByWorkspaceAndMonth(
    _context: NcContext,
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // knexConnection is intentional: metaCount only supports equality conditions,
    // but we need a date-range filter (>=) and workspace-wide scope across all bases.
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
