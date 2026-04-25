import { createHash } from 'crypto';
import type { MailchimpAuthIntegration } from '@noco-integrations/mailchimp-auth';

export function subscriberHash(email: string): string {
  return createHash('md5').update(email.toLowerCase()).digest('hex');
}

export async function fetchLists(
  auth: MailchimpAuthIntegration,
): Promise<{ label: string; value: string }[]> {
  return await auth.use(async (client) => {
    const response = await client.lists.getAllLists({ count: 1000 });
    return ((response as any).lists || []).map(
      (list: { name: string; id: string }) => ({
        label: list.name,
        value: list.id,
      }),
    );
  });
}

export async function fetchSegments(
  auth: MailchimpAuthIntegration,
  listId: string,
): Promise<{ label: string; value: string }[]> {
  return await auth.use(async (client) => {
    const response = await client.lists.listSegments(listId, {
      count: 1000,
    });
    return ((response as any).segments || []).map(
      (seg: { name: string; id: number }) => ({
        label: seg.name,
        value: String(seg.id),
      }),
    );
  });
}

export async function fetchTemplates(
  auth: MailchimpAuthIntegration,
): Promise<{ label: string; value: number }[]> {
  return await auth.use(async (client) => {
    const response = await client.templates.list({ count: 1000 });
    return ((response as any).templates || []).map(
      (tpl: { name: string; id: number }) => ({
        label: tpl.name,
        value: tpl.id,
      }),
    );
  });
}
