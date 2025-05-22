import { plainToClass } from "class-transformer";
import { ServerConfig } from "./model";
import { validateSync } from "class-validator";
import { Command, Option } from "commander"
import * as fs from 'fs'
import * as toml from 'toml'
import * as lodash from 'lodash'

const objectOcuppied = (obj: Object) => {
    if (typeof obj === 'undefined' || Object.values(obj).length === 0) {
        return false;
    }

    for (const key in obj) {
        if (typeof obj[key] === 'object' && objectOcuppied(obj[key])) {
            return true
        } else if (obj[key] !== undefined) {
            return true
        }
    }

    return false;
}

const rmUndefined = (obj: Object) => {
  let res = {};

  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'object') {
        if (objectOcuppied(obj[key])) res[key] = rmUndefined(obj[key]);
    } else if (obj[key] != undefined) {
        res[key] = obj[key];
    }
  });

  return res;
};

const fromEnv = (): Object => {
    let res = {
        host: process.env.HOST ?? "localhost",
        port: "8080",
        workerType: process.env.WORKER_TYPE ?? 'disabled',
        environment: process.env.NODE_ENV ?? "production",

        // nocoDbConfig: {
        //     isCloud: process.env.NC_CLOUD === 'true',
        //     licenseKey: process.env.NC_LICENSE_KEY,
        //     migrationJobsVersion: process.env.NC_MIGRATION_JOBS_VERSION ?? "8",
        //     version: process.env.NC_VERSION ?? '0258003',
        //     uuid: process.env.NC_SERVER_UUID,
        //     minimalDb: process.env.NC_MINIMAL_DBS === 'true',
        //     dataReflection: process.env.NC_PG_DATA_REFLECTION !== 'false',
        //     externalDb: process.env.NC_CONNECT_TO_EXTERNAL_DB !== 'false',
        // },

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
                secret: process.env.NC_AUTH_JWT_SECRET ?? "change-me-not-safe-for-production",
                time: process.env.NC_JWT_EXPIRES_IN ?? '10h',
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
            forcePathStyle: process.env.NC_S3_FORCE_PATH_STYL === 'true',
            endPoint: process.env.NC_S3_ENDPOINT,
        },

        smtpConfig: {
            ignoreTLS: process.env.NC_SMTP_IGNORE_TLS === 'true',
            passowrd: process.env.NC_SMTP_PASSWORD,
            rejectUnauthorized: process.env.NC_SMTP_REJECT_UNAUTHORIZED === 'false',
            secure: process.env.NC_SMTP_SECURE === 'false',
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
    const mergedCfg = lodash.merge(envCfg, tomlCfg, cliCfg) as ServerConfig;

    mergedCfg.publicUrl ??= `http://${mergedCfg.host}:${mergedCfg.port}/`;
    mergedCfg.dashboardUrl ??=  mergedCfg.nocoDbConfig.isCloud ? '/' : '/dashboard';
    if (mergedCfg.nocoDbConfig.externalDb) mergedCfg.nocoDbConfig.externalDb = !mergedCfg.nocoDbConfig.minimalDb;

    const serverConfig = plainToClass(ServerConfig, mergedCfg);
    validateSync(serverConfig);
    return serverConfig;
}

export const serverConfig = getCfg();
