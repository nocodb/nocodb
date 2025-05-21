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

class GoogleOidcConfig {
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
    @Type(() => GoogleOidcConfig)
    googleOidc: GoogleOidcConfig;

    // @IsDefined()
    // @IsNotEmptyObject()
    // @IsObject()
    // @ValidateNested()
    // @Type(() => JwtConfig)
    // jwt: JwtConfig;
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
}

const environments = ['testing', 'production', 'development', 'staging'] as const;
export class ServerConfig {
    @IsIP()
    host: string;
    @IsPort()
    port: number;
    @IsBoolean()
    seed: Boolean;
    @Min(0) // error
    @Max(4) // info
    logLevel: number;
    @IsUrl()
    publicUrl: string;
    // @Length(32)
    // secretMasterKey: string;

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
}

const serverConfigGet = (): ServerConfig => {
    let serverConfigRaw: ServerConfig = {
        host: process.env.HOST ?? "127.0.0.1",
        port: 8000,
        seed: process.env.SEED === "true" ? true : false,
        publicUrl: null,
        logLevel: Number("3"),
        // secretMasterKey: process.env.SECRET_MASTER_KEY,

        environment: process.env.NODE_ENV as typeof environments[number],

        nocoDbConfig: {
            isCloud: process.env.NC_CLOUD === 'true',
            licenseKey: process.env.NC_LICENSE_KEY,
            migrationJobsVersion: process.env.NC_MIGRATION_JOBS_VERSION ?? "8",
            version: process.env.NC_VERSION ?? '0258003',
            uuid: process.env.NC_SERVER_UUID
        },

        auth: {
            googleOidc: {
                clientId: process.env.NC_GOOGLE_CLIENT_ID,
                clientSecret: process.env.NC_GOOGLE_CLIENT_SECRET,
            },

            // jwt: {
            //     secret: process.env.JWT_SECRET,
            //     time:
            //         process.env.NODE_ENV === "development" ? "86400s" : "1200s",
            // },
        },
    };

    // derived config
    serverConfigRaw.publicUrl = process.env.NC_PUBLIC_URL ?? `http:${serverConfigRaw.host}:${serverConfigRaw.port}/`

    const serverConfig = plainToClass(ServerConfig, serverConfigRaw);
    const error = validateSync(serverConfig);
    if (error.length) {
        throw new Error(`${error}`);
    } else {
        return serverConfig;
    }
};

export default serverConfigGet();
