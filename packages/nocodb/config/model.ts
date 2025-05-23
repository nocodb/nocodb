import 'reflect-metadata';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmptyObject,
  IsOptional,
  IsPort,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';

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
  @ValidateNested()
  @Type(() => OidcConfig)
  googleOidc?: OidcConfig;

  @ValidateNested()
  @Type(() => OidcConfig)
  githubOidc?: OidcConfig;

  @ValidateNested()
  @Type(() => JwtConfig)
  jwt: JwtConfig;
}

class NocoDbConfig {
  @IsBoolean()
  isCloud: boolean;
  @IsOptional()
  licenseKey?: string;
  @IsBoolean()
  minimalDb: boolean;
  @IsBoolean()
  externalDb: boolean;
  @IsBoolean()
  dataReflection: boolean;
}

class SmtpConfig {
  @IsBoolean()
  ignoreTLS: boolean;
  @IsString()
  passowrd: string;
  @IsBoolean()
  rejectUnauthorized: boolean;
  @IsBoolean()
  secure: boolean;
  @IsString()
  username: string;
  @IsString()
  from: string;
  @IsString()
  host: string;
  @IsString()
  port: string;
}

class SesConfig {
  @IsString()
  accessKey: string;
  @IsString()
  secretKey: string;
  @IsString()
  region: string;
  @IsString()
  from: string;
}

class S3CloudConfig {
  @IsOptional()
  @IsString()
  accessKey?: string;
  @IsOptional()
  @IsString()
  secretKey?: string;
  @IsString()
  acl: string;
  @IsString()
  bucketName: string;
  @IsString()
  region: string;
}

class S3Config extends S3CloudConfig {
  @IsBoolean()
  forcePathStyle: boolean;
  @IsUrl()
  endPoint: string;
}

const environments = [
  'testing',
  'production',
  'development',
  'staging',
] as const;
const workerType = ['disabled', 'worker', 'main'] as const;

export class ServerConfig {
  host: string;
  @IsPort()
  port: string;
  @IsUrl({ require_tld: false })
  publicUrl: string;
  @IsIn(workerType)
  workerType: (typeof workerType)[number];
  @IsIn(environments)
  environment: (typeof environments)[number];
  @IsUrl({ require_host: false })
  dashboardUrl: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => NocoDbConfig)
  nocoDbConfig: NocoDbConfig;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AuthConfig)
  auth: AuthConfig;

  @ValidateNested()
  @Type(() => S3Config)
  s3Config?: S3Config;

  @ValidateNested()
  @Type(() => S3Config)
  s3CloudConfig?: S3CloudConfig;

  @ValidateNested()
  @Type(() => SmtpConfig)
  smtpConfig?: SmtpConfig;

  @ValidateNested()
  @Type(() => SesConfig)
  sesConfig?: SesConfig;
}
