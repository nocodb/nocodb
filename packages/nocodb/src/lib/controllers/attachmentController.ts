// @ts-ignore
import { Request, Response, Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk';
import path from 'path';
import slash from 'slash';
import Noco from '../Noco';
import { MetaTable } from '../utils/globals';
import mimetypes, { mimeIcons } from '../utils/mimeTypes';
import { Tele } from 'nc-help';
import extractProjectIdAndAuthenticate from '../meta/helpers/extractProjectIdAndAuthenticate';
import catchError, { NcError } from '../meta/helpers/catchError';
import NcPluginMgrv2 from '../meta/helpers/NcPluginMgrv2';
import Local from '../v1-legacy/plugins/adapters/storage/Local';
import { NC_ATTACHMENT_FIELD_SIZE } from '../constants';
import { getCacheMiddleware } from '../meta/api/helpers';
import { attachmentService } from '../services';

const isUploadAllowed = async (req: Request, _res: Response, next: any) => {
  if (!req['user']?.id) {
    if (!req['user']?.isPublicBase) {
      NcError.unauthorized('Unauthorized');
    }
  }

  try {
    // check user is super admin or creator
    if (
      req['user'].roles?.includes(OrgUserRoles.SUPER_ADMIN) ||
      req['user'].roles?.includes(OrgUserRoles.CREATOR) ||
      req['user'].roles?.includes(ProjectRoles.EDITOR) ||
      // if viewer then check at-least one project have editor or higher role
      // todo: cache
      !!(await Noco.ncMeta
        .knex(MetaTable.PROJECT_USERS)
        .where(function () {
          this.where('roles', ProjectRoles.OWNER);
          this.orWhere('roles', ProjectRoles.CREATOR);
          this.orWhere('roles', ProjectRoles.EDITOR);
        })
        .andWhere('fk_user_id', req['user'].id)
        .first())
    )
      return next();
  } catch {}
  NcError.badRequest('Upload not allowed');
};

export async function upload(req: Request, res: Response) {
  const attachments = await attachmentService.upload({
    files: (req as any).files,
    path: req.query?.path as string,
  });

  res.json(attachments);
}

export async function uploadViaURL(req: Request, res: Response) {
  const attachments = await attachmentService.uploadViaURL({
    urls: req.body,
    path: req.query?.path as string,
  });

  res.json(attachments);
}

export async function fileRead(req, res) {
  try {
    const {
      img,
      type,
    } = await attachmentService.fileRead({
      path: path.join(
        'nc',
        'uploads',
        req.params?.[0]
      ),
    })

    res.writeHead(200, { 'Content-Type': type });
    res.end(img, 'binary');
  } catch (e) {
    console.log(e);
    res.status(404).send('Not found');
  }
}

const router = Router({ mergeParams: true });

router.get(
  /^\/dl\/([^/]+)\/([^/]+)\/(.+)$/,
  getCacheMiddleware(),
  async (req, res) => {
    try {
      const {
        img,
        type,
      } = await attachmentService.fileRead({
        path:    path.join(
          'nc',
          req.params[0],
          req.params[1],
          'uploads',
          ...req.params[2].split('/')
        ),
      })

      res.writeHead(200, { 'Content-Type': type });
      res.end(img, 'binary');
    } catch (e) {
      res.status(404).send('Not found');
    }
  }
);


router.post(
  '/api/v1/db/storage/upload',
  multer({
    storage: multer.diskStorage({}),
    limits: {
      fieldSize: NC_ATTACHMENT_FIELD_SIZE,
    },
  }).any(),
  [
    extractProjectIdAndAuthenticate,
    catchError(isUploadAllowed),
    catchError(upload),
  ]
);

router.post(
  '/api/v1/db/storage/upload-by-url',

  [
    extractProjectIdAndAuthenticate,
    catchError(isUploadAllowed),
    catchError(uploadViaURL),
  ]
);

router.get(/^\/download\/(.+)$/, getCacheMiddleware(), catchError(fileRead));

export default router;
