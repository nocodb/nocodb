import debug from 'debug';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { Job } from 'bull';
import type { DbConfig } from '~/utils/nc-config';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { Base, DbServer, Workspace } from '~/models';
import { TelemetryService } from '~/services/telemetry.service';
import { metaUrlToDbConfig } from '~/utils/nc-config';

const NC_MIGRATOR_URL = process.env.NC_MIGRATOR_URL;
const NC_DATA_DB = process.env.NC_DATA_DB;

@Injectable()
export class CloudDbMigrateProcessor {
  private readonly debugLog = debug('nc:jobs:cloud-db-migrate');

  constructor(
    private readonly jobsLogService: JobsLogService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { workspaceId, conditions = {} } = job.data;

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    if (!NC_MIGRATOR_URL || NC_MIGRATOR_URL === '') {
      logBasic('NC_MIGRATOR_URL is not set');
      return;
    }

    let workspace;
    try {
      workspace = await Workspace.get(workspaceId);
      if (!workspace) {
        logBasic('Workspace not found');
        return;
      }

      if (workspace.fk_db_instance_id) {
        logBasic('Workspace already has a db server');

        await this.telemetryService.sendSystemEvent({
          event_type: 'payment_alert',
          payment_type: 'migration_failed',
          message: `Database migration failed for workspace ${workspace.title}`,
          workspace: { id: workspace.id, title: workspace.title },
          extra: {
            job_id: job.id,
            error_message: 'Already has a db server',
          },
        });

        return;
      }

      const dbServers = await DbServer.list({});

      if (dbServers.length === 0) {
        logBasic('No DbServer found');
        return;
      }

      const useDbServers: DbServer[] = [];

      const matchingDbServers = dbServers
        .filter((dbServer) => {
          if (
            // 0 or null means no limit
            dbServer.max_tenant_count &&
            dbServer.current_tenant_count >= dbServer.max_tenant_count
          ) {
            return false;
          }

          return true;
        })
        .filter((dbServer) => {
          // if dbServer has no conditions, skip
          if (!dbServer.conditions) return false;

          // check if required conditions are met
          return Object.keys(conditions).every(
            (key) => conditions[key] === dbServer.conditions[key],
          );
        });

      if (matchingDbServers.length > 0) {
        useDbServers.push(...matchingDbServers);
      } else {
        // check if there is available dbServer with no conditions
        const availableDbServers = dbServers.filter((dbServer) => {
          if (
            dbServer.max_tenant_count &&
            dbServer.current_tenant_count >= dbServer.max_tenant_count
          ) {
            return false;
          }

          // check if server has no conditions
          return !dbServer.conditions;
        });

        if (availableDbServers.length > 0) {
          useDbServers.push(...availableDbServers);
        }
      }

      if (useDbServers.length === 0) {
        logBasic('No matching DbServer found');
        return;
      }

      // use dbServer with minimum tenants
      let dbServer = useDbServers.sort(
        (a, b) => a.current_tenant_count - b.current_tenant_count,
      )[0];

      if (!dbServer) {
        logBasic('DbServer not found');
        return;
      }

      dbServer = await DbServer.getWithConfig(dbServer.id);

      await Workspace.update(workspaceId, {
        db_job_id: `${job.id}`,
      });

      const bases = await Base.listByWorkspace(workspaceId);

      const schemas = bases.map((base) => base.id);

      const dataDbConfig = await metaUrlToDbConfig(NC_DATA_DB);
      const targetDbConfig = dbServer.config as DbConfig;

      const dataDbUrl = this.dbConfigToJdbcUrl(dataDbConfig);
      const targetDbUrl = this.dbConfigToJdbcUrl(targetDbConfig, workspaceId);

      await this.telemetryService.sendSystemEvent({
        event_type: 'payment_alert',
        payment_type: 'migration_started',
        message: `Database migration started for workspace ${workspace.title}`,
        workspace: { id: workspace.id, title: workspace.title },
        extra: {
          job_id: job.id,
          db_server_id: dbServer.id,
          schema_count: schemas.length,
          conditions,
        },
      });

      const response = await axios.post(`${NC_MIGRATOR_URL}/api/v1/migrate`, {
        sourceUrl: dataDbUrl,
        targetUrl: targetDbUrl,
        schemas,
      });

      const { jobId } = response.data;

      let lastLog = '';

      const getStatus = async (resolve, reject) => {
        try {
          const response = await axios.get(
            `${NC_MIGRATOR_URL}/api/v1/migrate/${jobId}/status`,
          );
          const { status, message, progress } = response.data;

          const log = `${message} - ${progress}%`;

          if (log !== lastLog) {
            logBasic(log);
            lastLog = log;
          }

          if (status === 'completed') {
            await DbServer.incrementTenantCount(dbServer.id);

            await Workspace.update(workspaceId, {
              fk_db_instance_id: dbServer.id,
              db_job_id: null,
            });

            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'migration_completed',
              message: `Database migration completed successfully for workspace ${workspace.title}`,
              workspace: { id: workspace.id, title: workspace.title },
              extra: {
                job_id: job.id,
                migrator_job_id: jobId,
                db_server_id: dbServer.id,
                schema_count: schemas.length,
              },
            });

            resolve(true);
          } else if (status === 'failed') {
            await Workspace.update(workspaceId, {
              db_job_id: null,
            });

            // Send upgrade_failed notification
            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'migration_failed',
              message: `Database migration failed for workspace ${workspace.title}`,
              workspace: { id: workspace.id, title: workspace.title },
              extra: {
                job_id: job.id,
                migrator_job_id: jobId,
                error_message: message?.slice(0, 255),
                progress,
              },
            });

            reject(new Error(message));
          } else {
            setTimeout(() => getStatus(resolve, reject), 1000);
          }
        } catch (statusError) {
          // Send upgrade_failed notification for status check errors
          await this.telemetryService.sendSystemEvent({
            event_type: 'payment_alert',
            payment_type: 'migration_n_failed',
            message: `Database migration status check failed for workspace ${workspace.title}: ${statusError.message}`,
            workspace: { id: workspace.id, title: workspace.title },
            extra: {
              job_id: job.id,
              migrator_job_id: jobId,
              error_message: statusError.message?.slice(0, 255),
              error_type: 'status_check_failed',
            },
          });
          reject(statusError);
        }
      };

      return new Promise(getStatus);
    } catch (error) {
      await Workspace.update(workspaceId, {
        db_job_id: null,
      });

      // Send upgrade_failed notification for general errors
      if (workspace) {
        await this.telemetryService.sendSystemEvent({
          event_type: 'payment_alert',
          payment_type: 'migration_failed',
          message: `Database migration failed for workspace ${workspace.title}: ${error.message}`,
          workspace: { id: workspace.id, title: workspace.title },
          extra: {
            job_id: job.id,
            error_message: error.message,
            error_type: axios.isAxiosError(error)
              ? 'axios_error'
              : 'general_error',
          },
        });
      }

      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Something went wrong');
      } else {
        throw error;
      }
    }
  }

  dbConfigToJdbcUrl(config: DbConfig, database?: string) {
    return `postgresql://${config.connection.user}:${
      config.connection.password
    }@${config.connection.host}:${config.connection.port}/${
      database || config.connection.database
    }${config.connection.ssl ? '?sslmode=require' : ''}`;
  }
}
