import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { BaseUser, User, Workflow, WorkflowSubscriber } from '~/models';
import { processConcurrently } from '~/utils';

@Injectable()
export class WorkflowSubscribersService {
  async listSubscribers(context: NcContext, workflowId: string) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    const subscribers = await WorkflowSubscriber.list(context, workflowId);

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
    workflowId: string,
    userIds: string[],
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
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
          workflowId,
          userId,
        );

      if (!existingSubscription) {
        const subscriber = await WorkflowSubscriber.insert(context, {
          fk_automation_id: workflowId,
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
}
