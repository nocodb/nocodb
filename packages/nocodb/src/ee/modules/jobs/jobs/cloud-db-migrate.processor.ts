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

    const { workspaceId, conditions } = job.data;

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    if (!NC_MIGRATOR_URL || NC_MIGRATOR_URL === '') {
      logBasic('NC_MIGRATOR_URL is not set');
      return;
    }

    try {
      const dbServers = await DbServer.list({});

      if (dbServers.length === 0) {
        logBasic('No DbServer found');
        return;
      }

      const matchingDbServers = dbServers.filter((dbServer) => {
        if (!dbServer.conditions) return true;

        // check if dbServer.conditions is a subset of conditions
        return Object.keys(dbServer.conditions).every(
          (key) => conditions[key] === dbServer.conditions[key],
        );
      });

      if (matchingDbServers.length === 0) {
        logBasic('No matching DbServer found');
        return;
      }

      // use dbServer with minimum tenants
      const dbServer = matchingDbServers.sort(
        (a, b) => a.current_tenant_count - b.current_tenant_count,
      )[0];

      if (!dbServer) {
        logBasic('DbServer not found');
        return;
      }

      await Workspace.update(workspaceId, {
        db_job_id: `${job.id}`,
      });

      const bases = await Base.listByWorkspace(workspaceId);

      const schemas = bases.map((base) => base.id);

      const dataDbConfig = await metaUrlToDbConfig(NC_DATA_DB);
      const targetDbConfig = dbServer.config as DbConfig;

      const dataDbUrl = this.dbConfigToJdbcUrl(dataDbConfig);
      const targetDbUrl = this.dbConfigToJdbcUrl(targetDbConfig, workspaceId);

      const response = await axios.post(`${NC_MIGRATOR_URL}/api/v1/migrate`, {
        sourceUrl: dataDbUrl,
        targetUrl: targetDbUrl,
        schemas,
      });

      const { jobId } = response.data;

      let lastLog = '';

      const getStatus = async (resolve, reject) => {
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
          await Workspace.update(workspaceId, {
            fk_db_instance_id: dbServer.id,
            db_job_id: null,
          });

          resolve(true);
        } else if (status === 'failed') {
          reject(new Error(message));
        } else {
          setTimeout(() => getStatus(resolve, reject), 1000);
        }
      };

      return new Promise(getStatus);
    } catch (error) {
      await Workspace.update(workspaceId, {
        db_job_id: null,
      });

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
    }`;
  }
}
