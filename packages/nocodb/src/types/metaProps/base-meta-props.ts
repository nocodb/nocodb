import { z } from 'zod';

export const BaseMetaProps = z.strictObject({
  icon_color: z.string().optional(),
});
