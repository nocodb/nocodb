import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class ClickhouseService implements OnModuleInit, OnModuleDestroy {
    private client;
    private config;
    execute(query: string, isInsert?: boolean): Promise<any>;
    onModuleDestroy(): any;
    onModuleInit(): Promise<any>;
}
