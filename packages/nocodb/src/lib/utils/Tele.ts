import Emittery from 'emittery';
import { machineIdSync } from 'node-machine-id';
import axios from 'axios';
import os from 'os';
import isDocker from 'is-docker';
import { packageVersion } from './packageVersion';
import Analytics from '@rudderstack/rudder-sdk-node';

const isDisabled = !!process.env.NC_DISABLE_TELE;
const cache = !!process.env.NC_REDIS_URL;
const executable = !!process.env.NC_BINARY_BUILD;
const litestream = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_BUCKET
);

const sendEvt = () => {
  try {
    const upTime = Math.round(process.uptime() / 3600);
    Tele.emit('evt', {
      evt_type: 'alive',
      count: global.NC_COUNT,
      upTime,
    });

    Tele.event({
      event: 'alive',
      id: Tele.machineId,
      data: {
        cache,
        upTime,
        litestream,
        executable,
      },
    });
  } catch {}
};
setInterval(sendEvt, 4 * 60 * 60 * 1000);

class Tele {
  public static machineId: string;
  public static emitter: Emittery;

  private static config: Record<string, any>;
  private static client: any;

  static emit(event, data) {
    try {
      this._init();
      Tele.emitter.emit(event, data);
    } catch (e) {}
  }

  static init(config) {
    Tele.config = config;
    Tele._init();
  }

  static page(args) {
    this.emit('page', args);
  }

  static event(args) {
    this.emit('ph_event', args);
  }

  static _init() {
    try {
      if (!Tele.emitter) {
        Tele.emitter = new Emittery();
        Tele.machineId = machineIdSync();

        let package_id = '';
        let xc_version = '';
        try {
          xc_version = process.env.NC_SERVER_UUID;
          package_id = packageVersion;
        } catch (e) {
          console.log(e);
        }

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
        Tele.emitter.on('evt_app_started', async (msg: Record<string, any>) => {
          try {
            await waitForMachineId(teleData);
            if (isDisabled) return;

            if (msg && msg.count !== undefined) {
              global.NC_COUNT = msg.count;
            }

            await axios.post('https://nocodb.com/api/v1/telemetry', {
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

        Tele.emitter.on('evt', async (payload: Record<string, any>) => {
          try {
            await waitForMachineId(teleData);
            if (payload.check) {
              teleData.machine_id = `${machineIdSync()},,`;
            }
            if (isDisabled) return;

            if (payload.evt_type === 'project:invite') {
              global.NC_COUNT = payload.count || global.NC_COUNT;
            }
            if (payload.evt_type === 'user:first_signup') {
              global.NC_COUNT = +global.NC_COUNT || 1;
            }

            await axios.post('https://nocodb.com/api/v1/telemetry', {
              ...teleData,
              evt_type: payload.evt_type,
              payload: payload,
            });
          } catch (e) {
            // console.log(e)
          }
        });

        Tele.emitter.on(
          'evt_api_created',
          async (data: Record<string, any>) => {
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
                'https://nocodb.com/api/v1/telemetry/apis_created',
                stats
              );
            } catch (e) {}
          }
        );

        Tele.emitter.on('evt_subscribe', async (email) => {
          try {
            if (isDisabled) return;
            await axios.post(
              'https://nocodb.com/api/v1/newsletter/sdhjh34u3yuy34bj343jhj4iwolaAdsdj3434uiut4nn',
              {
                email,
              }
            );
          } catch (e) {}
        });

        Tele.emitter.on('page', async (args: Record<string, any>) => {
          try {
            if (isDisabled) return;
            const instanceMeta = await this.getInstanceMeta();

            this.client.track({
              userId: args.id || `${this.machineId}:public`,
              distinctId: args.id || `${this.machineId}:public`,
              event: '$pageview',
              properties: {
                ...teleData,
                ...instanceMeta,
                $current_url: args.path,
              },
            });
          } catch (e) {}
        });
        Tele.emitter.on('ph_event', async (args: Record<string, any>) => {
          try {
            if (isDisabled) return;
            const instanceMeta = await this.getInstanceMeta();
            let id = args.id;

            if (!id) {
              if (args.event && args.event.startsWith('a:api:')) {
                id = this.machineId;
              } else {
                id = `${this.machineId}:public`;
              }
            }

            this.client.track({
              userId: id,
              distinctId: id,
              event: args.event,
              properties: {
                ...teleData,
                ...instanceMeta,
                ...(args.data || {}),
              },
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    try {
      if (!this.client) {
        this.client = new Analytics(
          '26w4gRDLSWVX0rtMR0enhTIOu7G',
          'https://nocodbnavehd.dataplane.rudderstack.com/v1/batch',
          {
            logLevel: '-1',
          }
        );
      }
    } catch (e) {}
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
}

async function waitForMachineId(teleData) {
  let i = 5;
  while (i-- && !teleData.machine_id) {
    await new Promise((resolve) => setTimeout(() => resolve(null), 500));
  }
}

// keep polling the site url to avoid going machine idle
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
  } catch (e) {
    //
  }
}

export { Tele };
