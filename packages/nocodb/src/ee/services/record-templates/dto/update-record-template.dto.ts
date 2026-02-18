import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateRecordTemplateDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  template_data?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
