import { TimeGeneralHandler } from '~/db/field-handler/handlers/time/time.general.handler';

export class TimeMysqlHandler extends TimeGeneralHandler {
  override getTimeFormat(): string {
    return 'YYYY-MM-DD HH:mm:ss';
  }
}
