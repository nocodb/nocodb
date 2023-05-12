import { OnModuleInit } from '@nestjs/common';
import { ClickhouseService } from './clickhouse/clickhouse.service';
export declare class AppController implements OnModuleInit {
    private readonly clickhouseService;
    constructor(clickhouseService: ClickhouseService);
    syncApiExecTime(message: any): any;
}
