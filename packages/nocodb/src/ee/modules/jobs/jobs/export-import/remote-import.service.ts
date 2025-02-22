import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';
import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { parseProp, WorkspaceUserRoles } from 'nocodb-sdk';
import type { Request } from 'express';
import type { NcContext, NcRequest } from '~/interface/config';
import { BasesService } from '~/services/bases.service';
import { Base, Job, User, WorkspaceUser } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { RootScopes } from '~/utils/globals';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { extractProps } from '~/helpers/extractProps';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { RemoteImportHandler } from '~/modules/jobs/jobs/export-import/remote-import.helper';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';

const nanoid = customAlphabet('1234567890abcdef', 10);

@Injectable()
export class RemoteImportService {
  protected logger: Logger = new Logger(RemoteImportService.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly jobsLogService: JobsLogService,
    protected readonly jobsEventService: JobsEventService,
    protected readonly basesService: BasesService,
    protected readonly importService: ImportService,
    protected readonly workspaceUsersService: WorkspaceUsersService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async updateJob(jobId: string, payload: any, error = false) {
    try {
      const queueJob = await this.jobsService.jobsQueue.getJob(jobId);

      if (queueJob) {
        if (!error) {
          if (typeof payload === 'object') {
            payload = JSON.stringify(payload);
          }

          await this.jobsEventService.onCompleted(queueJob, payload);

          await queueJob.moveToCompleted(payload, true);
        } else {
          await this.jobsEventService.onFailed(queueJob, payload);

          await queueJob.moveToFailed(payload, true);
        }
      }
    } catch (e) {
      await this.jobsService.setJobResult(jobId, payload);
    }
  }

  async importUsers(
    context: NcContext,
    payload: {
      users: {
        email: string;
        display_name?: string;
      }[];
      req: NcRequest;
    },
  ) {
    const { users, req } = payload;

    const existingUsers = await WorkspaceUser.userList({
      fk_workspace_id: context.workspace_id,
      include_deleted: true,
    });

    const existingUserMap = new Map(
      existingUsers.map((user) => [user.email, user]),
    );

    for (const user of users) {
      if (existingUserMap.has(user.email)) {
        continue;
      }

      await this.workspaceUsersService.invite({
        workspaceId: context.workspace_id,
        body: {
          email: user.email,
          display_name: user.display_name,
          roles: WorkspaceUserRoles.NO_ACCESS,
        },
        invitedBy: req.user,
        // we don't want to send email invites so url can be empty
        siteUrl: '',
        skipEmailInvite: true,
        invitePassive: true,
        req,
      });
    }
  }

  async remoteImport(
    context: NcContext,
    workspaceId: string,
    payload: {
      baseId?: string;
      workspaceMode?: boolean;
      newBase?: boolean;
    },
    req: NcRequest,
  ) {
    if (!payload.baseId && !payload.workspaceMode) {
      NcError.badRequest('Base ID missing');
    }

    const base = await Base.get(
      {
        workspace_id: workspaceId,
        base_id: payload.baseId,
      },
      payload.baseId,
    );

    if (!base) {
      throw new Error(`Base not found for id '${payload.baseId}'`);
    }

    const source = (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    const secret = nanoid();

    const job = await this.jobsService.add(
      JobTypes.ListenImport,
      {
        context: {
          workspace_id: base.fk_workspace_id,
          base_id: base.id,
        },
        baseId: base.id,
        sourceId: source.id,
        user: req.user,
        req: {
          user: req.user,
          clientIp: req.clientIp,
        },
      },
      {
        delay: 10 * 60 * 1000,
      },
    );

    await this.jobsService.setJobResult(`${job.id}`, {
      ...payload,
      secret,
      timestamp: new Date().toISOString(),
      status: 'Listening',
    });

    return { id: job.id, secret: `${job.id}-${secret}` };
  }

  async abortRemoteImport(context: NcContext, secret: string, _req: NcRequest) {
    const secretHelper = secret.split('-');

    if (secretHelper.length !== 2) {
      NcError.badRequest(`No import listener found for ${secret}`);
    }

    const jobId = secretHelper[0];

    const secretCheck = secretHelper[1];

    const job = await Job.get(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      jobId,
    );

    if (!job) {
      NcError.badRequest(`No import listener found for ${secret}`);
    }

    const result = parseProp(job.result);

    if (result?.status !== 'Listening') {
      return true;
    }

    await this.jobsService.setJobResult(job.id, {
      secret: secretCheck,
      status: 'Aborted',
    });

    return true;
  }

  async remoteImportProcess(secret: string, dataReq: Request) {
    const secretHelper = secret.split('-');

    if (secretHelper.length !== 2) {
      NcError.badRequest(`No import listener found for ${secret}`);
    }

    const jobId = secretHelper[0];

    const secretCheck = secretHelper[1];

    const job = await Job.get(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      jobId,
    );

    if (!job) {
      NcError.badRequest(`No import listener found for ${secret}`);
    }

    const result = parseProp(job.result);

    if (result?.secret !== secretCheck) {
      NcError.badRequest(`No import listener found for ${secret}`);
    }

    if (result?.status !== 'Listening') {
      NcError.badRequest(`Already processed with status ${result.status}`);
    }

    // Check if expired (1 hour)
    if (new Date(result.timestamp).getTime() + 3600000 < Date.now()) {
      await this.jobsService.setJobResult(job.id, {
        secret: secretCheck,
        status: 'Expired',
      });
      NcError.badRequest(`Import listener expired for ${secret}`);
    }

    const user = await User.get(job.fk_user_id);

    const req = { user } as any;

    await this.jobsService.setJobResult(job.id, {
      secret: secretCheck,
      status: 'Processing',
    });

    const log = (message: string) => {
      this.jobsLogService.sendLog(job, {
        message,
      });
    };

    log('Importing data');

    const workspaceId = job.fk_workspace_id;

    const { workspaceMode: _, newBase, baseId } = result;

    const base = newBase
      ? await this.basesService.baseCreate({
          base: {
            title: 'Imported Base',
            type: 'database',
            ...{ fk_workspace_id: workspaceId },
          },
          user: { id: req.user.id },
          req: req,
        })
      : await Base.get(
          {
            workspace_id: workspaceId,
            base_id: baseId,
          },
          baseId,
        );

    const source = (await base.getSources())[0];

    if (!base || !source) {
      throw new Error(`Base or source not found!`);
    }

    log(`Importing to ${base.title}`);

    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    req.user = await User.getWithRoles(context, req.user.id, {
      user: req.user,
      baseId: base.id,
      workspaceId: base.fk_workspace_id,
    });

    const remoteImportHandler = new RemoteImportHandler(
      context,
      this,
      this.importService,
      req.user,
      base,
      source,
      req,
      log,
    );

    const jsonStream = dataReq
      .pipe(parser({ jsonStreaming: true }))
      .pipe(streamValues());

    try {
      await new Promise((resolve, reject) => {
        // stream & log req data
        jsonStream.on('data', ({ key: _, value }) => {
          remoteImportHandler.handleMessage(value);
        });

        jsonStream.on('error', (err) => {
          this.logger.error(err);
          reject(err);
        });

        jsonStream.on('end', () => {
          resolve(true);
        });
      });

      // wait for init set (schema & users) - queue will start after this
      await remoteImportHandler.initPromise;

      // wait for all data to be enqueued
      await remoteImportHandler.endPromise;

      // wait for import requests to complete
      await remoteImportHandler.importPromise;

      if (remoteImportHandler.error) {
        throw remoteImportHandler.error;
      }

      log('Import completed');

      await this.updateJob(job.id, {
        secret: secretCheck,
        status: 'Completed',
      });

      if (newBase) {
        const updatePayload = extractProps(remoteImportHandler.baseProps, [
          'title',
          'meta',
        ]);

        await this.basesService.baseUpdate(context, {
          baseId: base.id,
          base: updatePayload,
          user: req.user,
          req,
        });
      }
    } catch (err) {
      await this.updateJob(
        job.id,
        {
          message: err.message,
          data: {
            secret: secretCheck,
            status: 'Failed',
            error: err.message,
          },
        },
        true,
      );

      throw err;
    }

    return {
      id: job.id,
      base_id: base.id,
      fk_workspace_id: workspaceId,
      msg: 'Import completed',
    };
  }
}
