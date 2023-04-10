import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Response,
} from '@nestjs/common';
import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk';
import path from 'path';
import { NcError } from '../../helpers/catchError';
import Noco from '../../Noco';
import { MetaTable } from '../../utils/globals';
import { AttachmentsService } from './attachments.service';

const isUploadAllowedMw = async (req: Request, _res: Response, next: any) => {
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

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(
    '/api/v1/db/storage/upload',
    //   multer({
    //            storage: multer.diskStorage({}),
    // limits: {
    //   fieldSize: NC_ATTACHMENT_FIELD_SIZE,
    // },
    // }).any(),
    //   [
    //     extractProjectIdAndAuthenticate,
    //     catchError(isUploadAllowedMw),
    //     catchError(upload),
    //   ]
    // );
  )
  async upload(@Request() req: any, @Query('path') path: string) {
    const attachments = await this.attachmentsService.upload({
      files: (req as any).files,
      path: req.query?.path as string,
    });

    return attachments;
  }

  @Post('/api/v1/db/storage/upload-by-url')

  //   [
  //     extractProjectIdAndAuthenticate,
  //   catchError(isUploadAllowedMw),
  //   catchError(uploadViaURL),
  // ]
  // );
  async uploadViaURL(@Body() body: any, @Query('path') path: string) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
    });

    return attachments;
  }

  @Get(/^\/download\/(.+)$/)
  // , getCacheMiddleware(), catchError(fileRead));
  async fileRead(req, res) {
    try {
      const { img, type } = await this.attachmentsService.fileRead({
        path: path.join('nc', 'uploads', req.params?.[0]),
      });

      res.writeHead(200, { 'Content-Type': type });
      res.end(img, 'binary');
    } catch (e) {
      console.log(e);
      res.status(404).send('Not found');
    }
  }

  @Get(/^\/dl\/([^/]+)\/([^/]+)\/(.+)$/)
  // getCacheMiddleware(),
  async fileReadv2(@Request() req, @Response() res) {
    try {
      const { img, type } = await this.attachmentsService.fileRead({
        path: path.join(
          'nc',
          req.params[0],
          req.params[1],
          'uploads',
          ...req.params[2].split('/'),
        ),
      });

      res.writeHead(200, { 'Content-Type': type });
      res.end(img, 'binary');
    } catch (e) {
      res.status(404).send('Not found');
    }
  }
}
