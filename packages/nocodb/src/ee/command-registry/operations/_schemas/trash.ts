import { z } from 'zod';

const TRASH_RESOURCE_TYPES = [
  'dashboard',
  'extension',
  'field',
  'hook',
  'record',
  'script',
  'table',
  'view',
  'widget',
  'workflow',
  'appSync',
  'tableSync',
] as const;

export const trashRestoreSchema = z
  .object({
    resourceType: z.enum(TRASH_RESOURCE_TYPES),
    resourceId: z.string(),
  })
  .strict();
