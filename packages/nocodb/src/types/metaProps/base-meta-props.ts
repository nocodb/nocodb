import { z } from 'zod';

export const BaseMetaProps = z.strictObject({
  iconColor: z.string().optional(),
});
