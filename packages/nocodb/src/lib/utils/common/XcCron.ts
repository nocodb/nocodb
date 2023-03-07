import { CronJob } from 'cron';

import type { NcConfig } from '../../../interface/config';
import type Noco from '../../Noco';

import type BaseApiBuilder from './BaseApiBuilder';

// import * as tsc from "typescript";

export class XcCron {
  // @ts-ignore
  private app: Noco;
  // @ts-ignore
  private config: NcConfig;
  private apiBuilder: BaseApiBuilder<Noco>;
  private cronJobs: { [key: string]: CronJob };

  constructor(config: NcConfig, apiBuilder: BaseApiBuilder<Noco>, app: Noco) {
    this.app = app;
    this.config = config;
    this.apiBuilder = apiBuilder;
    this.cronJobs = {};
  }

  public async init(): Promise<any> {
    // const cronJobs = await this.apiBuilder.getDbDriver()('nc_cron').select();
    const cronJobs = await this.apiBuilder
      .getXcMeta()
      .metaList('', this.apiBuilder.dbAlias, 'nc_cron');

    for (const cron of cronJobs) {
      this.startCronJob(cron);
    }
  }

  public async restartCron(args: any): Promise<any> {
    // const cron = await this.apiBuilder.getDbDriver()('nc_cron').where('title', args.title).first();
    const cron = await this.apiBuilder
      .getXcMeta()
      .metaGet('', this.apiBuilder.dbAlias, 'nc_cron', { title: args.title });

    if (cron.id in this.cronJobs) {
      this.cronJobs[cron.id].stop();
    }
    this.startCronJob(cron);
  }

  public async removeCron(args: any): Promise<any> {
    if (args.id in this.cronJobs) {
      this.cronJobs[args.id].stop();
      delete this.cronJobs[args.id];
    }
  }

  private startCronJob(cron): void {
    if (!cron.active) {
      return;
    }
    try {
      const job = new CronJob(
        cron.pattern,
        this.generateCronHandlerFromStringBody(cron.cron_handler),
        null,
        true,
        cron.timezone || 'America/Los_Angeles'
      );
      job.start();
      this.cronJobs[cron.id] = job;
    } catch (e) {
      console.log('Error in cron initialization : ', e.message);
    }
  }

  private generateCronHandlerFromStringBody(fnBody: string): any {
    // @ts-ignore
    let handler = () => {
      console.log('Empty handler');
    };
    if (fnBody && fnBody.trim()) {
      try {
        const js = `((async function(){
          ${fnBody}
      }).bind(this))`;
        //   const js = tsc.transpile(`((async function(){
        //     ${fnBody}
        // }).bind(this))`, {
        //     strict: true,
        //     strictPropertyInitialization: true,
        //     strictNullChecks: true,
        //   });

        // tslint:disable-next-line:no-eval
        handler = eval(js);
        // console.timeEnd('startTrans')
      } catch (e) {
        console.log('Error in Cron handler transpilation', e);
      }

      // tslint:disable-next-line:no-eval
    }
    return handler;
  }
}
