// @ts-ignore
import { Request, Response, Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk';
import path from 'path';
import slash from 'slash';
import Noco from '../../Noco';
import { MetaTable } from '../../utils/globals';
import mimetypes, { mimeIcons } from '../../utils/mimeTypes';
import { Tele } from 'nc-help';
import extractProjectIdAndAuthenticate from '../helpers/extractProjectIdAndAuthenticate';
import catchError, { NcError } from '../helpers/catchError';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import Local from '../../v1-legacy/plugins/adapters/storage/Local';
import { NC_ATTACHMENT_FIELD_SIZE } from '../../constants';

const isUploadAllowed = async (req: Request, _res: Response, next: any) => {
  if (!req['user']?.id) {
    NcError.unauthorized('Unauthorized');
  }

  try {
    // check user is super admin or creator
    if (
      req['user'].roles?.includes(OrgUserRoles.SUPER_ADMIN) ||
      req['user'].roles?.includes(OrgUserRoles.CREATOR) ||
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
  const filePath = sanitizeUrlPath(
    req.query?.path?.toString()?.split('/') || ['']
  );
  const destPath = path.join('nc', 'uploads', ...filePath);

  const storageAdapter = await NcPluginMgrv2.storageAdapter();

  const attachments = await Promise.all(
    (req as any).files?.map(async (file) => {
      const fileName = `${nanoid(18)}${path.extname(file.originalname)}`;

      let url = await storageAdapter.fileCreate(
        slash(path.join(destPath, fileName)),
        file
      );

      let attachmentPath;

      // if `url` is null, then it is local attachment
      if (!url) {
        // then store the attachement path only
        // url will be constructued in `useAttachmentCell`
        attachmentPath = `download/${filePath.join('/')}/${fileName}`;
      }

      return {
        ...(url ? { url } : {}),
        ...(attachmentPath ? { path: attachmentPath } : {}),
        title: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        icon: mimeIcons[path.extname(file.originalname).slice(1)] || undefined,
      };
    })
  );

  Tele.emit('evt', { evt_type: 'image:uploaded' });

  res.json(attachments);
}

export async function uploadViaURL(req: Request, res: Response) {
  const filePath = sanitizeUrlPath(
    req.query?.path?.toString()?.split('/') || ['']
  );
  const destPath = path.join('nc', 'uploads', ...filePath);

  const storageAdapter = await NcPluginMgrv2.storageAdapter();

  const attachments = await Promise.all(
    req.body?.map?.(async (urlMeta) => {
      const { url, fileName: _fileName } = urlMeta;

      const fileName = `${nanoid(6)}${_fileName || url.split('/').pop()}`;

      let attachmentUrl = await (storageAdapter as any).fileCreateByUrl(
        slash(path.join(destPath, fileName)),
        url
      );

      if (!attachmentUrl) {
        attachmentUrl = `${(req as any).ncSiteUrl}/download/${filePath.join(
          '/'
        )}/${fileName}`;
      }

      return {
        url: attachmentUrl,
        title: fileName,
        mimetype: urlMeta.mimetype,
        size: urlMeta.size,
        icon: mimeIcons[path.extname(fileName).slice(1)] || undefined,
      };
    })
  );

  Tele.emit('evt', { evt_type: 'image:uploaded' });

  res.json(attachments);
}

export async function fileRead(req, res) {
  try {
    // get the local storage adapter to display local attachments
    const storageAdapter = new Local();
    const type =
      mimetypes[path.extname(req.params?.[0]).split('/').pop().slice(1)] ||
      'text/plain';

    const img = await storageAdapter.fileRead(
      slash(
        path.join(
          'nc',
          'uploads',
          req.params?.[0]
            ?.split('/')
            .filter((p) => p !== '..')
            .join('/')
        )
      )
    );
    res.writeHead(200, { 'Content-Type': type });
    res.end(img, 'binary');
  } catch (e) {
    console.log(e);
    res.status(404).send('Not found');
  }
}

const router = Router({ mergeParams: true });

router.get(/^\/dl\/([^/]+)\/([^/]+)\/(.+)$/, async (req, res) => {
  try {
    // const type = mimetypes[path.extname(req.params.fileName).slice(1)] || 'text/plain';
    const type =
      mimetypes[path.extname(req.params[2]).split('/').pop().slice(1)] ||
      'text/plain';

    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    // const img = await this.storageAdapter.fileRead(slash(path.join('nc', req.params.projectId, req.params.dbAlias, 'uploads', req.params.fileName)));
    const img = await storageAdapter.fileRead(
      slash(
        path.join(
          'nc',
          req.params[0],
          req.params[1],
          'uploads',
          ...req.params[2].split('/')
        )
      )
    );
    res.writeHead(200, { 'Content-Type': type });
    res.end(img, 'binary');
  } catch (e) {
    res.status(404).send('Not found');
  }
});

export function sanitizeUrlPath(paths) {
  return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
}

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

router.get(/^\/download\/(.+)$/, catchError(fileRead));

export default router;
