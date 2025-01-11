import os from 'os';
import Emittery from 'emittery';
import { machineIdSync } from 'node-machine-id';
import axios from 'axios';
import isDocker from 'is-docker';
import { packageVersion } from '~/utils/packageVersion';
import TeleBatchProcessor from '~/utils/TeleBatchProcessor';
import { isEE } from '~/utils';
import { getRedisURL } from '~/helpers/redisHelpers';

const isDisabled = !!process.env.NC_DISABLE_TELE;
const cache = !!getRedisURL();
const executable = !!process.env.NC_BINARY_BUILD;
const litestream = !!(
  process.env.LITESTREAM_S3_BUCKET &&
  process.env.LITESTREAM_S3_SECRET_ACCESS_KEY &&
  process.env.LITESTREAM_S3_ACCESS_KEY_ID
);

const sendEvt = () => {
  try {
    const upTime = Math.round(process.uptime() / 3600);
    Tele.emit('evt', {
      evt_type: 'alive',
      count: global.NC_COUNT,
      upTime,
      cache,
      litestream,
      executable,
    });
  } catch {}
};
setInterval(sendEvt, 8 * 60 * 60 * 1000);

class Tele {
  static emitter;
  static machineId;
  static config: Record<string, any>;
  static client: TeleBatchProcessor;

  static emit(event, data) {
    try {
      this._init();
      Tele.emitter.emit(event, data);
    } catch (e) {}
  }

  static init(config: Record<string, any>) {
    Tele.config = config;
    Tele._init();
  }

  static page(args: Record<string, any>) {
    this.emit('page', args);
  }

  static event(args: Record<string, any>) {
    this.emit('ph_event', args);
  }

  static _init() {
    try {
      if (!Tele.emitter) {
        Tele.emitter = new Emittery();
        Tele.machineId = machineIdSync();

        let package_id = '';
        let xc_version = '';
        xc_version = process.env.NC_SERVER_UUID;
        package_id = packageVersion;

        const teleData: Record<string, any> = {
          package_id,
          os_type: os.type(),
          os_platform: os.platform(),
          os_release: os.release(),
          node_version: process.version,
          docker: isDocker(),
          xc_version: xc_version,
          env: process.env.NODE_ENV || 'production',
          oneClick: !!process.env.NC_ONE_CLICK,
        };
        teleData.machine_id = `${machineIdSync()},,`;
        Tele.emitter.on('evt_app_started', async (msg) => {
          try {
            await waitForMachineId(teleData);
            if (isDisabled) return;

            if (msg && msg.count !== undefined) {
              global.NC_COUNT = msg.count;
            }

            await axios.post('https://telemetry.nocodb.com/api/v1/telemetry', {
              ...teleData,
              evt_type: 'started',
              payload: {
                count: global.NC_COUNT,
              },
            });
          } catch (e) {
          } finally {
            sendEvt();
          }
        });

        Tele.emitter.on('evt', async (payload) => {
          try {
            const instanceMeta = (await Tele.getInstanceMeta()) || {};

            await waitForMachineId(teleData);
            if (payload.check) {
              teleData.machine_id = `${machineIdSync()},,`;
            }
            if (
              isDisabled &&
              !(
                payload.evt_type &&
                payload.evt_type.startsWith('a:sync-request:')
              )
            )
              return;

            if (payload.evt_type === 'project:invite') {
              global.NC_COUNT = payload.count || global.NC_COUNT;
            }
            if (payload.evt_type === 'user:first_signup') {
              global.NC_COUNT = +global.NC_COUNT || 1;
            }

            await axios.post('https://telemetry.nocodb.com/api/v1/telemetry', {
              ...teleData,
              evt_type: payload.evt_type,
              payload: { ...instanceMeta, ...(payload || {}) },
            });
          } catch {}
        });

        Tele.emitter.on('evt_api_created', async (data) => {
          try {
            await waitForMachineId(teleData);
            const stats = {
              ...teleData,
              table_count: data.tablesCount || 0,
              relation_count: data.relationsCount || 0,
              view_count: data.viewsCount || 0,
              api_count: data.apiCount || 0,
              function_count: data.functionsCount || 0,
              procedure_count: data.proceduresCount || 0,
              mysql: data.dbType === 'mysql2' ? 1 : 0,
              pg: data.dbType === 'pg' ? 1 : 0,
              mssql: data.dbType === 'mssql' ? 1 : 0,
              sqlite3: data.dbType === 'sqlite3' ? 1 : 0,
              oracledb: data.dbType === 'oracledb' ? 1 : 0,
              rest: data.type === 'rest' ? 1 : 0,
              graphql: data.type === 'graphql' ? 1 : 0,
              grpc: data.type === 'grpc' ? 1 : 0,
              time_taken: data.timeTaken,
            };
            if (isDisabled) return;
            await axios.post(
              'https://telemetry.nocodb.com/api/v1/telemetry/apis_created',
              stats,
            );
          } catch (e) {}
        });

        Tele.emitter.on('evt_subscribe', async (email) => {
          try {
            if (isDisabled) return;
            await axios.post(
              'https://telemetry.nocodb.com/api/v1/newsletter/sdhjh34u3yuy34bj343jhj4iwolaAdsdj3434uiut4nn',
              {
                email,
              },
            );
          } catch (e) {}
        });

        Tele.emitter.on('page', async (args) => {
          try {
            if (isDisabled) return;
            const instanceMeta = await Tele.getInstanceMeta();

            await this.client.capture({
              distinctId: args.id || `${this.machineId}:public`,
              event: '$pageview',
              properties: {
                ...teleData,
                ...instanceMeta,
                $current_url: args.path,
              },
            });
          } catch {}
        });
        Tele.emitter.on('ph_event', async (payload: Record<string, any>) => {
          try {
            if (
              isDisabled &&
              !(
                payload.evt_type &&
                payload.evt_type.startsWith('a:sync-request:')
              )
            )
              return;
            const instanceMeta = await this.getInstanceMeta();
            let id = payload.id;

            if (!id) {
              if (payload.event && payload.event.startsWith('a:api:')) {
                id = this.machineId;
              } else {
                id = `${this.machineId}:public`;
              }
            }
            await this.client.capture({
              // userId: id,
              distinctId: id,
              event: payload.event,
              properties: {
                ...teleData,
                ...instanceMeta,
                ...(payload.data || {}),
              },
            });
          } catch {}
        });
      }
    } catch (e) {}

    try {
      if (!this.client) {
        this.client = new TeleBatchProcessor();
      }
    } catch {}
  }

  static async getInstanceMeta() {
    try {
      return (
        (Tele.config &&
          Tele.config.instance &&
          (await Tele.config.instance())) ||
        {}
      );
    } catch {
      return {};
    }
  }

  static get id() {
    return this.machineId || machineIdSync();
  }

  static async payload() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development' ||
      isEE
    )
      return null;

    const payload: Record<string, any> = {
      package_id: packageVersion,
      node_version: process.version,
      xc_version: process.env.NC_SERVER_UUID,
      env: process.env.NODE_ENV || 'production',
      oneClick: !!process.env.NC_ONE_CLICK,
      disabled: isDisabled,
    };
    try {
      payload.os_type = os.type();
      payload.os_platform = os.platform();
      payload.os_release = os.release();
      payload.docker = isDocker();
      payload.machine_id = `${this.id},,`;
      payload.payload = {
        ...((await Tele.getInstanceMeta()) || {}),
        count: global.NC_COUNT,
        upTime: Math.round(process.uptime() / 3600),
        cache,
        litestream,
        executable,
      };
    } catch {
      // ignore
    }
    return payload;
  }
}

async function waitForMachineId(teleData) {
  let i = 5;
  while (i-- && !teleData.machine_id) {
    await new Promise((resolve) => setTimeout(() => resolve(null), 500));
  }
}

// this is to keep the server alive
if (process.env.NC_PUBLIC_URL) {
  setInterval(() => {
    axios({
      method: 'get',
      url: process.env.NC_PUBLIC_URL,
    })
      .then(() => {})
      .catch(() => {});
  }, 2 * 60 * 60 * 1000);
}

if (process.env.NC_ONE_CLICK) {
  try {
    Tele.emit('evt', {
      evt_type: 'ONE_CLICK',
    });
  } catch {}
}

export { Tele };
