import debug from 'debug';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { Job } from 'bull';
import type { DbConfig } from '~/utils/nc-config';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { Base, DbServer, Org, Workspace } from '~/models';
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

    const {
      workspaceOrOrgId,
      conditions = {},
      targetOrgId = null,
      oldDbServerId = null,
      // Direct target server override. When set, bypasses the conditions
      // picker entirely and uses this server (subject to existence and
      // capacity checks). Mutually exclusive with `targetOrgId`.
      dbServerId = null,
      // When true, force `skipCreateDb=false` regardless of whether
      // targetOrg is set. Used when placing a workspace into a freshly
      // created org whose DB does not yet exist on the target server.
      createTargetDb = false,
    } = job.data;

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    if (!NC_MIGRATOR_URL || NC_MIGRATOR_URL === '') {
      logBasic('NC_MIGRATOR_URL is not set');
      return;
    }

    let workspaceOrOrg: {
      id?: string;
      title?: string;
      fk_db_instance_id?: string;
      entity: 'workspace' | 'org';
    };

    let workspaces = [];

    try {
      const workspace = await Workspace.get(workspaceOrOrgId);
      if (workspace) {
        workspaceOrOrg = {
          ...workspace,
          entity: 'workspace',
        };
      } else {
        const org = await Org.get(workspaceOrOrgId);
        if (org) {
          workspaceOrOrg = {
            ...org,
            entity: 'org',
          };
        } else {
          logBasic('Workspace or Org not found');
          return;
        }
      }

      if (
        (workspaceOrOrg.fk_db_instance_id && !oldDbServerId) ||
        (oldDbServerId && workspaceOrOrg.fk_db_instance_id !== oldDbServerId)
      ) {
        logBasic(
          'Workspace or Org already has a DbServer assigned, skipping migration',
        );
        return;
      }

      const targetOrg = targetOrgId ? await Org.get(targetOrgId) : null;

      const dbServers = await DbServer.list({});

      if (dbServers.length === 0) {
        logBasic('No DbServer found');
        return;
      }

      const useDbServers: DbServer[] = [];

      if (dbServerId) {
        // Direct override — pick the named server, ignore the picker.
        // Still respect capacity. Default-for-orgs is allowed here since
        // the caller named the server explicitly.
        const dbServer = dbServers.find((s) => s.id === dbServerId);
        if (!dbServer) {
          logBasic(`Target db server ${dbServerId} not found`);
          return;
        }
        if (
          dbServer.max_tenant_count &&
          dbServer.current_tenant_count >= dbServer.max_tenant_count
        ) {
          logBasic(`Target db server ${dbServerId} is at capacity`);
          return;
        }
        useDbServers.push(dbServer);
      } else if (targetOrg) {
        if (!targetOrg.fk_db_instance_id) {
          logBasic('Target Org has no db server assigned');
          return;
        }
        const dbServer = await DbServer.get(targetOrg.fk_db_instance_id);
        if (dbServer) {
          useDbServers.push(dbServer);
        } else {
          logBasic('Target Org db server not found');
          return;
        }
      } else {
        // Default-for-orgs servers are reserved as a fallback bucket for
        // org databases — they must never be auto-picked for workspace
        // migrations, even if they match the job's conditions. Org
        // migrations are allowed to land on them (that's literally the
        // whole point of the bucket).
        const excludeDefaultForOrgs = workspaceOrOrg.entity === 'workspace';
        const isDefaultForOrgs = (s: DbServer) =>
          (s.conditions as any)?.default_for_orgs === true;

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
            if (excludeDefaultForOrgs && isDefaultForOrgs(dbServer))
              return false;

            // if dbServer has no conditions, skip
            if (!dbServer.conditions) return false;

            // if no conditions are specified, skip
            if (Object.keys(conditions).length === 0) return false;

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

            // already excluded by the !dbServer.conditions guard, but be
            // explicit so the intent is clear (and a no-op for orgs since
            // default-for-orgs servers always carry the marker condition)
            if (excludeDefaultForOrgs && isDefaultForOrgs(dbServer))
              return false;

            // check if server has no conditions
            return !dbServer.conditions;
          });

          if (availableDbServers.length > 0) {
            useDbServers.push(...availableDbServers);
          }
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

      let oldDbServerConfig: DbConfig;

      if (oldDbServerId) {
        // if oldDbServerId is 'nc', use the nc_data_db config (only for internal use, in case something goes wrong)
        if (oldDbServerId === 'nc') {
          oldDbServerConfig = await metaUrlToDbConfig(NC_DATA_DB);
        } else {
          oldDbServerConfig = (await DbServer.getWithConfig(oldDbServerId))
            ?.config as DbConfig;
        }
      }

      // Skip only when source and target are identical at BOTH layers:
      // same physical server AND same logical database name.
      //   - entity=workspace, no targetOrg  → target db = workspace.id (same as source)
      //   - entity=org, no targetOrg        → target db = org.id (same as source)
      //   - entity=workspace, targetOrg=O   → target db = O.id, source db = workspace.id (different)
      //   - entity=org A, targetOrg=B       → target db = B.id, source db = A.id (different)
      const sameServer = workspaceOrOrg.fk_db_instance_id === dbServer.id;
      const sameDbName = !targetOrg || workspaceOrOrg.id === targetOrg.id;
      if (sameServer && sameDbName) {
        logBasic('Workspace/Org already at the target location');
        return;
      }

      dbServer = await DbServer.getWithConfig(dbServer.id);

      workspaces =
        workspaceOrOrg.entity === 'workspace'
          ? [workspaceOrOrg]
          : await Workspace.listByOrgId({
              orgId: workspaceOrOrgId,
            });

      const schemas = [];

      for (const workspace of workspaces) {
        await Workspace.update(workspace.id, {
          db_job_id: `${job.id}`,
        });

        const bases = await Base.listByWorkspace(workspace.id, {
          includeDeleted: true,
          includeSnapshot: true,
        });

        schemas.push(...bases.map((base) => base.id));
      }

      const dataDbConfig =
        oldDbServerConfig || (await metaUrlToDbConfig(NC_DATA_DB));
      const targetDbConfig = dbServer.config as DbConfig;

      const dataDbUrl = this.dbConfigToJdbcUrl(
        dataDbConfig,
        oldDbServerConfig ? workspaceOrOrgId : undefined,
      );
      const targetDbUrl = this.dbConfigToJdbcUrl(
        targetDbConfig,
        targetOrg?.id || workspaceOrOrgId,
      );

      await this.telemetryService.sendSystemEvent({
        event_type: 'payment_alert',
        payment_type: 'migration_started',
        message: `Database migration started for workspace ${workspaceOrOrg.title}`,
        workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
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
        // Skip target DB creation only for "merge into existing org"
        // (targetOrg set, createTargetDb not requested). Fresh-org placement
        // sets createTargetDb=true so the new `org.id` DB gets created.
        skipCreateDb: !createTargetDb && !!targetOrg,
      });

      const { jobId } = response.data;

      let lastLog = '';

      const getStatus = async (resolve, reject) => {
        try {
          const response = await axios.get(
            `${NC_MIGRATOR_URL}/api/v1/migrate/${jobId}/status`,
          );
          const { status, message, progress } = response.data;

          const log = `${message} : ${progress}%`;

          if (log !== lastLog) {
            logBasic(log);
            lastLog = log;
          }

          if (status === 'completed') {
            await DbServer.incrementTenantCount(dbServer.id);

            if (oldDbServerId && oldDbServerId !== 'nc') {
              await DbServer.decrementTenantCount(oldDbServerId);
            }

            if (workspaceOrOrg.entity === 'org') {
              await Org.update(workspaceOrOrgId, {
                fk_db_instance_id: dbServer.id,
              });
            }

            for (const workspace of workspaces) {
              if (workspaceOrOrg.entity === 'workspace') {
                await Workspace.update(workspace.id, {
                  fk_db_instance_id: dbServer.id,
                  db_job_id: null,
                });
              } else {
                await Workspace.update(workspace.id, {
                  fk_db_instance_id: null,
                  db_job_id: null,
                });
              }
            }

            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'migration_completed',
              message: `Database migration completed successfully for workspace ${workspaceOrOrg.title}`,
              workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
              extra: {
                job_id: job.id,
                migrator_job_id: jobId,
                db_server_id: dbServer.id,
                schema_count: schemas.length,
              },
            });

            resolve(true);
          } else if (status === 'failed') {
            for (const workspace of workspaces) {
              await Workspace.update(workspace.id, {
                db_job_id: null,
              });
            }

            // Send upgrade_failed notification
            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'migration_failed',
              message: `Database migration failed for workspace ${workspaceOrOrg.title}`,
              workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
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
            payment_type: 'migration_failed',
            message: `Database migration status check failed for workspace ${workspaceOrOrg.title}: ${statusError.message}`,
            workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
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
      for (const workspace of workspaces) {
        await Workspace.update(workspace.id, {
          db_job_id: null,
        });
      }

      // Send upgrade_failed notification for general errors
      if (workspaceOrOrg) {
        await this.telemetryService.sendSystemEvent({
          event_type: 'payment_alert',
          payment_type: 'migration_failed',
          message: `Database migration failed for workspace ${workspaceOrOrg.title}: ${error.message}`,
          workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
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
