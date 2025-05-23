import { plainToClass } from "class-transformer";
import { ServerConfig } from "./model";
import { validateSync } from "class-validator";
import { Command, Option } from "commander"
import * as fs from 'fs'
import * as toml from 'toml'
import lodash from 'lodash'
import { rmUndefined, stringToBoolTry} from './util'

const fromDefault = (): Object => {
    return {
        host: "localhost",
        port: "8080",
        workerType: 'disabled',
        environment: "production",

        nocoDbConfig: {
            isCloud: false,
            migrationJobsVersion: "8",
            version: '0258003',
            minimalDb: false,
            dataReflection: true,
            externalDb: true,
        },

        auth: {
            jwt: {
                secret: "change-me-not-safe-for-production",
                time: '10h',
            }
        },
        s3Config: {
            forcePathStyle: false,
        },

        smtpConfig: {
            ignoreTLS: false,
            rejectUnauthorized: false,
            secure: false,
        },
    };
};

const fromEnv = (): Object => {
    let res = {
        host: process.env.HOST,
        port: process.env.PORT,
        workerType: process.env.WORKER_TYPE,
        environment: process.env.NODE_ENV,

        nocoDbConfig: {
            isCloud: stringToBoolTry(process.env.NC_CLOUD),
            licenseKey: process.env.NC_LICENSE_KEY,
            migrationJobsVersion: process.env.NC_MIGRATION_JOBS_VERSION,
            version: process.env.NC_VERSION,
            uuid: process.env.NC_SERVER_UUID,
            minimalDb: stringToBoolTry(process.env.NC_MINIMAL_DBS),
            dataReflection: stringToBoolTry(process.env.NC_PG_DATA_REFLECTION),
            externalDb: stringToBoolTry(process.env.NC_CONNECT_TO_EXTERNAL_DB),
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
                time: process.env.NC_JWT_EXPIRES_IN,
            }
        },
        s3CloudConfig: {
            accessKey: process.env.NC_CLOUD_S3_ACCESS_SECRET,
            secretKey: process.env.NC_CLOUD_S3_ACCESS_SECRET,
            acl: process.env.NC_CLOUD_S3_ACL,
            bucketName: process.env.NC_CLOUD_S3_ACL,
            region: process.env.NC_CLOUD_S3_REGION,
        },
        s3Config: {
            accessKey: process.env.NC_S3_ACCESS_SECRET,
            secretKey: process.env.NC_S3_ACCESS_SECRET,
            acl: process.env.NC_S3_ACL,
            bucketName: process.env.NC_S3_ACL,
            region: process.env.NC_S3_REGION,
            forcePathStyle: stringToBoolTry(process.env.NC_S3_FORCE_PATH_STYL),
            endPoint: process.env.NC_S3_ENDPOINT,
        },

        smtpConfig: {
            ignoreTLS: stringToBoolTry(process.env.NC_SMTP_IGNORE_TLS),
            passowrd: process.env.NC_SMTP_PASSWORD,
            rejectUnauthorized: stringToBoolTry(process.env.NC_SMTP_REJECT_UNAUTHORIZED),
            secure: stringToBoolTry(process.env.NC_SMTP_SECURE),
            username: process.env.NC_SMTP_USERNAME,
            from: process.env.NC_SMTP_FROM,
            host: process.env.NC_SMTP_HOST,
            port: process.env.NC_SMTP_PORT,
        },
        sesConfig: {
            accessKey: process.env.NC_CLOUD_SES_ACCESS_KEY,
            secretKey: process.env.NC_CLOUD_SES_ACCESS_SECRET,
            region: process.env.NC_CLOUD_SES_REGION,
            from: process.env.NC_CLOUD_SES_FROM,
        },
    };

    return rmUndefined(res);

};

const fromToml = (): Object => {
    const defaultCfgPaths = [
        "./nocodb.toml",
        "/etc/nocodb.toml",
    ];

    let tomlString: string
    if (typeof process.env.NC_CFG_TOML !== 'undefined') {
            tomlString = fs.readFileSync('NC_CFG_TOML', 'utf8')
    } else {
        for (const cfgPath of defaultCfgPaths) {
            if (!fs.existsSync(cfgPath)) {
                continue;
            }

            tomlString = fs.readFileSync(cfgPath, 'utf8');
            break;
        }

        if (typeof tomlString === 'undefined') {
            return {}
        }
    }

    return toml.parse(tomlString)
}

const fromCli = (): Object => {
    const program = new Command();
    program
        .name('nocodb')
        .description('Open Source Airtable Alternative')
        .addOption(new Option('-h, --host <host>', 'Bind host for NocoDB'))
        .addOption(new Option('-p, --port <port>', 'Bind port for NocoDB'))

    const parsed = program.parse();
    return parsed.opts();
}

const getCfg = () => {
    const cliCfg = fromCli();
    const tomlCfg = fromToml();
    const envCfg = fromEnv();
    const defaultCfg = fromDefault();
    const mergedCfg = lodash.merge(defaultCfg, tomlCfg, envCfg, cliCfg) as ServerConfig;

    mergedCfg.publicUrl ??= `http://${mergedCfg.host}:${mergedCfg.port}/`;
    mergedCfg.dashboardUrl ??=  mergedCfg.nocoDbConfig.isCloud ? '/' : '/dashboard';
    if (mergedCfg.nocoDbConfig.externalDb) mergedCfg.nocoDbConfig.externalDb = !mergedCfg.nocoDbConfig.minimalDb;

    const serverConfig = plainToClass(ServerConfig, mergedCfg);
    validateSync(serverConfig);
    return serverConfig;
}

export const serverConfig = getCfg();
