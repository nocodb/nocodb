import ChatSessionCE from 'src/models/ChatSession';
import type { ChatSessionType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import ChatMessage from '~/models/ChatMessage';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

export default class ChatSession
  extends ChatSessionCE
  implements ChatSessionType
{
  id?: string;
  title?: string;
  fk_base_id: string;
  fk_workspace_id?: string;
  fk_user_id?: string;
  summary?: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  message_count?: number;
  created_at?: string;
  updated_at?: string;

  constructor(data: ChatSession) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!sessionId) {
      return null;
    }

    let session =
      sessionId &&
      (await NocoCache.get(
        context,
        `${CacheScope.CHAT_SESSION}:${sessionId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!session) {
      session = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.CHAT_SESSIONS,
        {
          id: sessionId,
        },
      );

      if (session) {
        await NocoCache.set(
          context,
          `${CacheScope.CHAT_SESSION}:${session.id}`,
          session,
        );
      }
    }

    return session && new ChatSession(session);
  }

  public static async list(
    context: NcContext,
    {
      baseId,
      userId,
    }: {
      baseId: string;
      userId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.CHAT_SESSION,
      [baseId],
    );
    let { list: sessionsList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !sessionsList.length) {
      const condition: Record<string, any> = {
        base_id: baseId,
      };

      if (userId) {
        condition.fk_user_id = userId;
      }

      sessionsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.CHAT_SESSIONS,
        {
          condition,
          orderBy: {
            updated_at: 'desc',
          },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.CHAT_SESSION,
        [baseId],
        sessionsList,
      );
    }

    // Filter by userId in-memory if fetched from cache
    let filtered = sessionsList;
    if (userId) {
      filtered = sessionsList.filter((s) => s.fk_user_id === userId);
    }

    return filtered.map((s) => new ChatSession(s));
  }

  static async insert(
    context: NcContext,
    session: Partial<ChatSession>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(session, [
      'id',
      'title',
      'fk_workspace_id',
      'fk_user_id',
    ]);

    (insertObj as any).base_id = context.base_id;

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_SESSIONS,
      insertObj,
    );

    return ChatSession.get(context, id, ncMeta).then(async (chatSession) => {
      await NocoCache.appendToList(
        context,
        CacheScope.CHAT_SESSION,
        [context.base_id],
        `${CacheScope.CHAT_SESSION}:${id}`,
      );
      return chatSession;
    });
  }

  static async update(
    context: NcContext,
    sessionId: string,
    session: Partial<ChatSession>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(session, [
      'title',
      'summary',
      'total_input_tokens',
      'total_output_tokens',
      'message_count',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_SESSIONS,
      updateObj,
      {
        id: sessionId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.CHAT_SESSION}:${sessionId}`,
      updateObj,
    );

    return this.get(context, sessionId, ncMeta);
  }

  static async delete(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Delete all messages in this session first
    await ChatMessage.deleteBySessionId(context, sessionId, ncMeta);

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CHAT_SESSIONS,
      {
        id: sessionId,
      },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.CHAT_SESSION}:${sessionId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }
}
