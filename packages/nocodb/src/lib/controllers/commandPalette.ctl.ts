import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { commandPaletteService } from '../services';
import type { Request, Response } from 'express';
import type { UserType } from 'nocodb-sdk';

export async function commandPalette(req: Request, res: Response) {
  const data = commandPaletteService.commandPalette({
    user: (req as any)?.session?.passport?.user as UserType,
    body: req.body,
  });

  return res.status(200).json(data);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/command_palette',
  ncMetaAclMw(commandPalette, 'commandPalette')
);

export default router;
