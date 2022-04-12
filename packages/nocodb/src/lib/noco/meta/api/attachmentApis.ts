// @ts-ignore
import { Request, Response, Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { Tele } from 'nc-help';
import path from 'path';
import slash from 'slash';
import mimetypes, { mimeIcons } from '../../../utils/mimeTypes';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import catchError from '../helpers/catchError';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';

// const storageAdapter = new Local();
export async function upload(req: Request, res: Response) {
  const filePath = sanitizeUrlPath([
    req.params.orgs,
    req.params.projectName,
    req.params.tableName,
    req.params.columnName
  ]);
  const destPath = path.join('nc', 'uploads', ...filePath);

  const storageAdapter = await NcPluginMgrv2.storageAdapter();
  const attachments = await Promise.all(
    (req as any).files?.map(async file => {
      const fileName = `${nanoid(6)}${path.extname(file.originalname)}`;

      let url = await storageAdapter.fileCreate(
        slash(path.join(destPath, fileName)),
        file
      );

      if (!url) {
        url = `${
          (req as any).ncSiteUrl
        }/api/v1/db/data-attachment/${filePath.join('/')}/${fileName}`;
      }

      return {
        url,
        title: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        icon: mimeIcons[path.extname(file.originalname).slice(1)] || undefined
      };
    })
  );

  Tele.emit('evt', { evt_type: 'image:uploaded' });

  res.json(attachments);
}
export async function fileRead(req, res) {
  try {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    // const type = mimetypes[path.extname(req.params.fileName).slice(1)] || 'text/plain';
    const type =
      mimetypes[
        path
          .extname(req.params.fileName)
          .split('/')
          .pop()
          .slice(1)
      ] || 'text/plain';
    // const img = await this.storageAdapter.fileRead(slash(path.join('nc', req.params.projectId, req.params.dbAlias, 'uploads', req.params.fileName)));
    const img = await storageAdapter.fileRead(
      slash(
        path.join(
          'nc',
          'uploads',
          req.params.orgs,
          req.params.projectName,
          req.params.tableName,
          req.params.columnName,
          req.params.fileName
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
      mimetypes[
        path
          .extname(req.params[2])
          .split('/')
          .pop()
          .slice(1)
      ] || 'text/plain';

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
  return paths.map(url => url.replace(/[/.?#]+/g, '_'));
}

router.post(
  '/api/v1/db/data-attachment/:orgs/:projectName/:tableName/:columnName',
  multer({
    storage: multer.diskStorage({})
  }).any(),
  ncMetaAclMw(upload, 'upload')
);
router.get(
  '/api/v1/db/data-attachment/:orgs/:projectName/:tableName/:columnName/:fileName',
  catchError(fileRead)
);

export default router;
