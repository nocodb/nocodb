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
  const destPath = path.join(
    'nc',
    'uploads',
    req.params.projectId,
    req.params.viewId
  );

  const storageAdapter = await NcPluginMgrv2.storageAdapter();
  const attachments = await Promise.all(
    (req as any).files?.map(async file => {
      const fileName = `${nanoid(6)}${path.extname(file.originalname)}`;

      let url = await storageAdapter.fileCreate(
        slash(path.join(destPath, fileName)),
        file
      );

      if (!url) {
        url = `${(req as any).ncSiteUrl}/download/${req.params.projectId}/${
          req.params.viewId
        }/${fileName}`;
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
          req.params.projectId,
          req.params.viewId,
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

router.post(
  '/projects/:projectId/views/:viewId/upload',
  multer({
    storage: multer.diskStorage({})
  }).any(),
  ncMetaAclMw(upload)
);
router.get('/download/:projectId/:viewId/:fileName', catchError(fileRead));

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
export default router;
