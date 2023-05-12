type NcConfig = any;
type DbConfig = any;
declare const defaultConnectionConfig: any;
declare const defaultConnectionOptions: {
    pool: {
        min: number;
        max: number;
    };
};
export default class NcConfigFactory {
    static make(): Promise<any>;
    static getToolDir(): string;
    static hasDbUrl(): boolean;
    static makeFromUrls(urls: string[]): NcConfig;
    static urlToDbConfig(urlString: string, key?: string, config?: NcConfigFactory, type?: string): DbConfig;
    private static generateRandomTitle;
    static metaUrlToDbConfig(urlString: any): Promise<any>;
    static makeProjectConfigFromUrl(url: any, type?: string): Promise<NcConfig>;
    static makeProjectConfigFromConnection(dbConnectionConfig: any, type?: string): Promise<NcConfig>;
    version: string;
    port: number;
    auth?: any;
    env: 'production' | 'dev' | 'test' | string;
    workingEnv: string;
    toolDir: string;
    envs: {
        [p: string]: {
            db: DbConfig[];
            api?: any;
            publicUrl?: string;
        };
    };
    queriesFolder: string | string[];
    seedsFolder: string | string[];
    title: string;
    publicUrl: string;
    projectType: any;
    meta: {
        db: {
            client: string;
            connection: {
                filename: string;
            };
        };
    };
    mailer: any;
    try: boolean;
    dashboardPath: string;
    constructor();
    static jdbcToXcUrl(): Promise<void>;
    static extractXcUrlFromJdbc(url: string, rtConfig?: boolean): any;
}
export { defaultConnectionConfig, defaultConnectionOptions };
