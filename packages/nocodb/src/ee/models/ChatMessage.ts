import ChatMessageCE from 'src/models/ChatMessage';
import type { ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

const JSON_FIELDS = ['tool_calls', 'tool_results'];

export default class ChatMessage
  extends ChatMessageCE
  implements ChatMessageType
{
  id?: string;
  fk_session_id: string;
  role: ChatMessageType['role'];
  content?: string | null;
  tool_calls?: ChatMessageType['tool_calls'];
  tool_results?: ChatMessageType['tool_results'];
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
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.CHAT_MESSAGE,
      [sessionId],
    );
    let { list: messagesList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !messagesList.length) {
      messagesList = await ncMeta.metaList2(
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

      // Only cache if no pagination (full list)
      if (!limit && !offset) {
        await NocoCache.setList(
          context,
          CacheScope.CHAT_MESSAGE,
          [sessionId],
          messagesList,
        );
      }
    }

    return messagesList.map((m) => new ChatMessage(m));
  }

  static async insert(
    context: NcContext,
    message: Partial<ChatMessage>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertObj = extractProps(message, [
      'id',
      'fk_session_id',
      'fk_workspace_id',
      'role',
      'content',
      'tool_calls',
      'tool_results',
      'model',
      'input_tokens',
      'output_tokens',
    ]);

    (insertObj as any).base_id = context.base_id;

    insertObj = prepareForDb(insertObj, JSON_FIELDS);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      insertObj,
    );

    return ChatMessage.get(context, id, ncMeta).then(async (chatMessage) => {
      await NocoCache.appendToList(
        context,
        CacheScope.CHAT_MESSAGE,
        [message.fk_session_id],
        `${CacheScope.CHAT_MESSAGE}:${id}`,
      );
      return chatMessage;
    });
  }

  static async update(
    context: NcContext,
    messageId: string,
    data: Partial<Pick<ChatMessage, 'tool_calls' | 'tool_results' | 'content'>>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = prepareForDb(
      extractProps(data, ['tool_calls', 'tool_results', 'content']),
      JSON_FIELDS,
    );

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_MESSAGES,
      updateObj,
      { id: messageId },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.CHAT_MESSAGE}:${messageId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

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

    await NocoCache.deepDel(
      context,
      `${CacheScope.CHAT_MESSAGE}:${messageId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  static async deleteBySessionId(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const messages = await this.list(context, { sessionId }, ncMeta);

    for (const message of messages) {
      await this.delete(context, message.id, ncMeta);
    }
  }

  static async countByWorkspaceAndMonth(
    context: NcContext,
    workspaceId: string,
    ncMeta = Noco.ncMeta,
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
