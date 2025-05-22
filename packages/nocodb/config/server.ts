import 'reflect-metadata'
import { plainToClass, Type } from "class-transformer";
import {
    IsBoolean,
    IsDefined,
    IsIn,
    IsIP,
    IsNotEmptyObject,
    IsObject,
    IsOptional,
    IsPort,
    isPositive,
    IsPositive,
    IsUrl,
    IsUUID,
    Length,
    Max,
    Min,
    ValidateNested,
    validateSync,
} from "class-validator";
import { isEE } from '~/utils';

class OidcConfig {
    @Length(8, 64)
    clientSecret: string;
    @Length(8, 64)
    clientId: string;
}

class JwtConfig {
    @Length(16, 128)
    secret: string;
    @Length(2, 16)
    time: string;
}

class AuthConfig {
    @IsNotEmptyObject()
    @IsObject()
    @ValidateNested()
    @Type(() => OidcConfig)
    googleOidc: OidcConfig;

    @IsNotEmptyObject()
    @IsObject()
    @ValidateNested()
    @Type(() => OidcConfig)
    githubOidc: OidcConfig;

    @IsDefined()
    @IsNotEmptyObject()
    @IsObject()
    @ValidateNested()
    @Type(() => JwtConfig)
    jwt: JwtConfig;
}

class NocoDbConfig {
    @IsBoolean()
    isCloud: Boolean;

    @IsOptional()
    licenseKey: string;

    migrationJobsVersion: string;
    version: string;

    @IsUUID()
    uuid: string;

    @IsBoolean()
    minimalDb: boolean;

    @IsBoolean()
    externalDb: boolean;

    @IsBoolean()
    dataReflection: boolean
}

const environments = ['testing', 'production', 'development', 'staging'] as const;
const workerType = ['disabed', 'worker', 'main'] as const;
export class ServerConfig {
    @IsIP()
    host: string;
    @IsPort()
    port: number;
    @IsUrl()
    publicUrl: string;

    @IsDefined()
    @IsNotEmptyObject()
    @IsObject()
    @ValidateNested()
    @Type(() => AuthConfig)
    auth: AuthConfig;

    @IsDefined()
    @IsNotEmptyObject()
    @IsObject()
    @ValidateNested()
    @Type(() => NocoDbConfig)
    nocoDbConfig: NocoDbConfig;

    @IsIn(environments)
    environment: typeof environments[number];

    @IsIn(workerType)
    workerType: typeof workerType[number];

    dashboardUrl: string
}

const serverConfigGet = (): ServerConfig => {
    let serverConfigRaw: ServerConfig = {
        host: process.env.HOST ?? "127.0.0.1",
        port: 8000,
        publicUrl: null,
        dashboardUrl: null,
        workerType: process.env.WORKER_TYPE,
        environment: process.env.NODE_ENV as typeof environments[number] ?? "production",

        nocoDbConfig: {
            isCloud: process.env.NC_CLOUD === 'true',
            licenseKey: process.env.NC_LICENSE_KEY,
            migrationJobsVersion: process.env.NC_MIGRATION_JOBS_VERSION ?? "8",
            version: process.env.NC_VERSION ?? '0258003',
            uuid: process.env.NC_SERVER_UUID,
            minimalDb: process.env.NC_MINIMAL_DBS === 'true',
            externalDb: null,
            dataReflection: process.env.NC_PG_DATA_REFLECTION !== 'false'
        },

        auth: {
            googleOidc: {
                clientId: process.env.NC_GOOGLE_CLIENT_ID,
                clientSecret: process.env.NC_GOOGLE_CLIENT_SECRET,
            },
            githubOidc: {
                clientId: process.env.NC_GITHUB_CLIENT_ID,
                clientSecret: process.env.NC_GITHUB_CLIENT_SECRET,
            },
            jwt: {
                secret: process.env.NC_AUTH_JWT_SECRET,
                time: process.env.NC_JWT_EXPIRES_IN ?? '10h',
            }
        },
    };

    // derived config
    serverConfigRaw.publicUrl = process.env.NC_PUBLIC_URL ?? `http:${serverConfigRaw.host}:${serverConfigRaw.port}/`;
    serverConfigRaw.dashboardUrl = process.env.NC_DASHBOARD_URL ??  (isEE || serverConfigRaw.nocoDbConfig.isCloud ? '/' : '/dashboard');
    if (process.env.NC_CONNECT_TO_EXTERNAL_DB == undefined) {
        serverConfigRaw.nocoDbConfig.externalDb = !serverConfigRaw.nocoDbConfig.minimalDb;
    } else {
        serverConfigRaw.nocoDbConfig.externalDb = process.env.NC_CONNECT_TO_EXTERNAL_DB !== 'false';
    }

    const serverConfig = plainToClass(ServerConfig, serverConfigRaw);
    const error = validateSync(serverConfig);
    if (error.length) {
        throw new Error(`${error}`);
    } else {
        return serverConfig;
    }
};

export default serverConfigGet();
