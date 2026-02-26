import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

export interface IWorkflowSubscriber {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  fk_automation_id: string;
  fk_user_id: string;
  notify_on_error: boolean;
  created_at?: string;
  updated_at?: string;
}

export default class WorkflowSubscriber implements IWorkflowSubscriber {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  fk_automation_id: string;
  fk_user_id: string;
  notify_on_error: boolean;
  created_at?: string;
  updated_at?: string;

  constructor(subscriber: Partial<WorkflowSubscriber>) {
    Object.assign(this, subscriber);
  }

  public static async get(
    context: NcContext,
    subscriberId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<WorkflowSubscriber | null> {
    let subscriber = await NocoCache.get(
      context,
      `${CacheScope.AUTOMATION_SUBSCRIBER}:${subscriberId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!subscriber) {
      subscriber = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATION_SUBSCRIBERS,
        subscriberId,
      );

      if (subscriber) {
        await NocoCache.set(
          context,
          `${CacheScope.AUTOMATION_SUBSCRIBER}:${subscriberId}`,
          subscriber,
        );
      }
    }

    return subscriber ? new WorkflowSubscriber(subscriber) : null;
  }

  public static async list(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<WorkflowSubscriber[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.AUTOMATION_SUBSCRIBER,
      [workflowId],
    );

    const { isNoneList } = cachedList;
    let { list: subscriberList } = cachedList;

    if (!isNoneList && !subscriberList.length) {
      subscriberList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATION_SUBSCRIBERS,
        {
          condition: {
            fk_automation_id: workflowId,
          },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.AUTOMATION_SUBSCRIBER,
        [workflowId],
        subscriberList,
      );
    }

    return subscriberList.map((s) => new WorkflowSubscriber(s));
  }

  public static async insert(
    context: NcContext,
    subscriber: Partial<WorkflowSubscriber>,
    ncMeta = Noco.ncMeta,
  ): Promise<WorkflowSubscriber> {
    const insertObj = extractProps(subscriber, [
      'fk_automation_id',
      'fk_user_id',
      'notify_on_error',
    ]);

    insertObj.fk_workspace_id = context.workspace_id;
    insertObj.base_id = context.base_id;

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.AUTOMATION_SUBSCRIBER,
        [subscriber.fk_automation_id],
        `${CacheScope.AUTOMATION_SUBSCRIBER}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    subscriberId: string,
    subscriber: Partial<WorkflowSubscriber>,
    ncMeta = Noco.ncMeta,
  ): Promise<WorkflowSubscriber> {
    const updateObj = extractProps(subscriber, ['notify_on_error']);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      updateObj,
      subscriberId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.AUTOMATION_SUBSCRIBER}:${subscriberId}`,
      updateObj,
    );

    return this.get(context, subscriberId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    subscriberId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const subscriber = await this.get(context, subscriberId, ncMeta);

    if (!subscriber) {
      return false;
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      subscriberId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.AUTOMATION_SUBSCRIBER}:${subscriberId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return true;
  }

  public static async deleteByWorkflow(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    // Get all subscribers first to clear cache properly
    const subscribers = await this.list(context, workflowId, ncMeta);

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      {
        fk_automation_id: workflowId,
      },
    );

    // Clear cache for each subscriber
    for (const subscriber of subscribers) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.AUTOMATION_SUBSCRIBER}:${subscriber.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    return true;
  }

  public static async getByWorkflowAndUser(
    context: NcContext,
    workflowId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<WorkflowSubscriber | null> {
    const subscriber = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      {
        fk_automation_id: workflowId,
        fk_user_id: userId,
      },
    );

    return subscriber ? new WorkflowSubscriber(subscriber) : null;
  }

  public static async getErrorSubscribers(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<WorkflowSubscriber[]> {
    const subscribers = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      {
        condition: {
          fk_automation_id: workflowId,
          notify_on_error: true,
        },
      },
    );

    return subscribers.map((s) => new WorkflowSubscriber(s));
  }

  public static async deleteByUserAndBase(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const subscribers = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      {
        condition: {
          fk_user_id: userId,
        },
      },
    );

    if (subscribers.length === 0) {
      return true;
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATION_SUBSCRIBERS,
      {
        fk_user_id: userId,
      },
    );

    for (const subscriber of subscribers) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.AUTOMATION_SUBSCRIBER}:${subscriber.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    return true;
  }
}
