import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRecordTemplateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  template_data: Record<string, any>;
}
