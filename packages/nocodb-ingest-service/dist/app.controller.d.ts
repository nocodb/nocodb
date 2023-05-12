import { ClickhouseService } from './clickhouse/clickhouse.service';
export declare class AppController {
    private readonly clickhouseService;
    constructor(clickhouseService: ClickhouseService);
    syncApiExecTime(messages: any[]): Promise<void>;
}
