import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { BaseUser, Hook, User, WorkflowSubscriber } from '~/models';
import { processConcurrently } from '~/utils';

@Injectable()
export class HookSubscribersService {
  async listSubscribers(context: NcContext, hookId: string) {
    const hook = await Hook.get(context, hookId);

    if (!hook) {
      NcError.hookNotFound(hookId);
    }

    const subscribers = await WorkflowSubscriber.list(context, hookId);

    if (!subscribers.length) {
      return [];
    }

    return await processConcurrently(subscribers, async (subscriber) => {
      const user = await User.get(subscriber.fk_user_id);
      return {
        id: subscriber.id,
        fk_user_id: subscriber.fk_user_id,
        email: user?.email ?? null,
        display_name: user?.display_name ?? null,
      };
    });
  }

  async addSubscribers(
    context: NcContext,
    hookId: string,
    userIds: string[],
  ) {
    const hook = await Hook.get(context, hookId);

    if (!hook) {
      NcError.hookNotFound(hookId);
    }

    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: context.base_id,
    });
    const validUserIds = new Set(baseUsers.map((bu) => bu.id));
    const filteredUserIds = userIds.filter((id) => validUserIds.has(id));

    const results = [];

    for (const userId of filteredUserIds) {
      const existingSubscription =
        await WorkflowSubscriber.getByWorkflowAndUser(
          context,
          hookId,
          userId,
        );

      if (!existingSubscription) {
        const subscriber = await WorkflowSubscriber.insert(context, {
          fk_automation_id: hookId,
          fk_user_id: userId,
          notify_on_error: true,
        });
        results.push(subscriber);
      }
    }

    return results;
  }

  async removeSubscriber(context: NcContext, subscriberId: string) {
    const subscriber = await WorkflowSubscriber.get(context, subscriberId);

    if (!subscriber) {
      return { success: true };
    }

    await WorkflowSubscriber.delete(context, subscriberId);

    return { success: true };
  }

  async deleteAllSubscribers(context: NcContext, hookId: string) {
    await WorkflowSubscriber.deleteByWorkflow(context, hookId);
    return { success: true };
  }
}
