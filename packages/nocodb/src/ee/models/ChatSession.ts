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
  RootScopes,
} from '~/utils/globals';

export default class ChatSession
  extends ChatSessionCE
  implements ChatSessionType
{
  id?: string;
  title?: string;
  fk_workspace_id: string;
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
        RootScopes.WORKSPACE,
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
      workspaceId,
      userId,
    }: {
      workspaceId: string;
      userId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (!userId) return [];

    const cachedList = await NocoCache.getList(
      context,
      CacheScope.CHAT_SESSION,
      [workspaceId, userId],
    );
    const { list: sessionsList, isNoneList } = cachedList;

    if (!isNoneList && !sessionsList.length) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.CHAT_SESSIONS,
        {
          condition: { fk_user_id: userId },
          orderBy: { updated_at: 'desc' },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.CHAT_SESSION,
        [workspaceId, userId],
        rows,
      );

      return rows.map((s) => new ChatSession(s));
    }

    return sessionsList.map((s) => new ChatSession(s));
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

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.CHAT_SESSIONS,
      insertObj,
    );

    return ChatSession.get(context, id, ncMeta).then(async (chatSession) => {
      if (chatSession?.fk_user_id) {
        await NocoCache.appendToList(
          context,
          CacheScope.CHAT_SESSION,
          [chatSession.fk_workspace_id, chatSession.fk_user_id],
          `${CacheScope.CHAT_SESSION}:${id}`,
        );
      }
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
      RootScopes.WORKSPACE,
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

  static async incrementTokens(
    context: NcContext,
    sessionId: string,
    {
      inputTokens,
      outputTokens,
      title,
    }: {
      inputTokens: number;
      outputTokens: number;
      title?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (!sessionId || !context.workspace_id) {
      return null;
    }

    await ncMeta
      .knex(MetaTable.CHAT_SESSIONS)
      .where({ id: sessionId, fk_workspace_id: context.workspace_id })
      .increment({
        total_input_tokens: inputTokens,
        total_output_tokens: outputTokens,
        message_count: 1,
      });

    if (title) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.CHAT_SESSIONS,
        { title },
        { id: sessionId },
      );
    }

    // Invalidate cache so next get() fetches fresh data
    await NocoCache.del(context, `${CacheScope.CHAT_SESSION}:${sessionId}`);
  }

  static async delete(
    context: NcContext,
    sessionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Delete all messages in this session first.
    // Don't pass ncMeta — messages use their own satellite DB (Noco.ncChatMessages).
    await ChatMessage.deleteBySessionId(context, sessionId);

    await ncMeta.metaDelete(
      context.workspace_id,
      RootScopes.WORKSPACE,
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
