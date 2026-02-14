import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/catchError';
import RecordTemplate from '~/models/RecordTemplate';
import Model from '~/models/Model';
import Column from '~/models/Column';
import type { CreateRecordTemplateDto } from './dto/create-record-template.dto';
import type { UpdateRecordTemplateDto } from './dto/update-record-template.dto';

@Injectable()
export class RecordTemplatesService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly datasService: DatasService,
  ) {}

  async list(param: {
    context: NcContext;
    baseId: string;
    sourceId?: string;
    req: NcRequest;
  }) {
    return await RecordTemplate.list(param.context, {
      base_id: param.baseId,
      source_id: param.sourceId,
    });
  }

  async listBySource(param: {
    context: NcContext;
    baseId: string;
    sourceId: string;
    req: NcRequest;
  }) {
    return await RecordTemplate.list(param.context, {
      base_id: param.baseId,
      source_id: param.sourceId,
    });
  }

  async get(param: { context: NcContext; templateId: string; req: NcRequest }) {
    const template = await RecordTemplate.get(param.context, param.templateId);
    if (!template) {
      NcError.notFound('Record template not found');
    }
    return template;
  }

  async create(param: {
    context: NcContext;
    baseId: string;
    sourceId: string;
    body: CreateRecordTemplateDto;
    userId: string;
    req: NcRequest;
  }) {
    // Validate template data structure
    this.validateTemplateData(param.body.template_data);

    const template = await RecordTemplate.insert(param.context, {
      base_id: param.baseId,
      source_id: param.sourceId,
      title: param.body.title,
      description: param.body.description,
      template_data: param.body.template_data,
      created_by: param.userId,
    });

    this.appHooksService.emit(AppEvents.RECORD_TEMPLATE_CREATE, {
      context: param.context,
      template,
      req: param.req,
    } as any);

    return template;
  }

  async update(param: {
    context: NcContext;
    templateId: string;
    body: UpdateRecordTemplateDto;
    userId: string;
    req: NcRequest;
  }) {
    const existingTemplate = await RecordTemplate.get(
      param.context,
      param.templateId,
    );
    if (!existingTemplate) {
      NcError.notFound('Record template not found');
    }

    // Validate template data structure if provided
    if (param.body.template_data) {
      this.validateTemplateData(param.body.template_data);
    }

    const template = await RecordTemplate.update(
      param.context,
      param.templateId,
      {
        title: param.body.title,
        description: param.body.description,
        template_data: param.body.template_data,
      },
    );

    this.appHooksService.emit(AppEvents.RECORD_TEMPLATE_UPDATE, {
      context: param.context,
      template,
      req: param.req,
    } as any);

    return template;
  }

  async delete(param: {
    context: NcContext;
    templateId: string;
    userId: string;
    req: NcRequest;
  }) {
    const template = await RecordTemplate.get(
      param.context,
      param.templateId,
    );
    if (!template) {
      NcError.notFound('Record template not found');
    }

    await RecordTemplate.delete(param.context, param.templateId);

    this.appHooksService.emit(AppEvents.RECORD_TEMPLATE_DELETE, {
      context: param.context,
      template,
      req: param.req,
    } as any);

    return { success: true };
  }

  async use(param: {
    context: NcContext;
    templateId: string;
    userId: string;
    req: NcRequest;
  }) {
    const template = await RecordTemplate.get(
      param.context,
      param.templateId,
    );
    if (!template) {
      NcError.notFound('Record template not found');
    }

    // Increment usage count
    const updatedTemplate = await RecordTemplate.incrementUsageCount(
      param.context,
      param.templateId,
    );

    this.appHooksService.emit(AppEvents.RECORD_TEMPLATE_USE, {
      context: param.context,
      template: updatedTemplate,
      req: param.req,
    } as any);

    return updatedTemplate;
  }

  /**
   * Validates template data structure
   * Ensures nested records don't exceed 3-table depth limit
   */
  private validateTemplateData(
    templateData: Record<string, any>,
    depth: number = 1,
  ) {
    if (depth > 3) {
      NcError.badRequest(
        'Template depth exceeds maximum limit of 3 related tables',
      );
    }

    if (!templateData) {
      NcError.badRequest('Template data is required');
    }

    // Validate linked_records structure if present
    if (templateData.linked_records) {
      for (const [fieldId, config] of Object.entries(
        templateData.linked_records,
      )) {
        if (typeof config !== 'object' || !config) {
          NcError.badRequest(
            `Invalid linked record config for field ${fieldId}`,
          );
        }

        const linkedConfig = config as any;

        // Validate mode
        if (!['existing', 'create_new'].includes(linkedConfig.mode)) {
          NcError.badRequest(
            `Invalid mode for linked field ${fieldId}. Must be 'existing' or 'create_new'`,
          );
        }

        // If create_new mode, validate nested configs
        if (
          linkedConfig.mode === 'create_new' &&
          linkedConfig.create_configs
        ) {
          if (!Array.isArray(linkedConfig.create_configs)) {
            NcError.badRequest(
              `create_configs for field ${fieldId} must be an array`,
            );
          }

          // Recursively validate nested template data
          for (const nestedConfig of linkedConfig.create_configs) {
            if (nestedConfig.template_data) {
              this.validateTemplateData(nestedConfig.template_data, depth + 1);
            }
          }
        }
      }
    }
  }

  /**
   * Creates records recursively from template data
   * Handles nested linked record creation up to 3 levels deep
   */
  async createFromTemplate(param: {
    context: NcContext;
    templateId: string;
    baseId: string;
    sourceId: string;
    userId: string;
    req: NcRequest;
  }): Promise<any> {
    const template = await RecordTemplate.get(
      param.context,
      param.templateId,
    );
    if (!template) {
      NcError.notFound('Record template not found');
    }

    // Get model
    const model = await Model.get(param.context, param.sourceId);
    if (!model) {
      NcError.notFound('Table not found');
    }

    // Parse template data
    const templateData =
      typeof template.template_data === 'string'
        ? JSON.parse(template.template_data)
        : template.template_data;

    // Create record with nested records
    const recordId = await this.createRecordRecursive({
      context: param.context,
      model,
      templateData,
      userId: param.userId,
      req: param.req,
    });

    // Increment usage count
    await RecordTemplate.incrementUsageCount(
      param.context,
      param.templateId,
    );

    return { id: recordId };
  }

  /**
   * Recursively creates records with nested linked records
   */
  private async createRecordRecursive(param: {
    context: NcContext;
    model: Model;
    templateData: any;
    userId: string;
    req: NcRequest;
    depth?: number;
  }): Promise<string> {
    const depth = param.depth || 1;

    if (depth > 3) {
      NcError.badRequest('Template depth exceeds maximum limit');
    }

    // Prepare record data with regular fields
    const recordData: any = { ...param.templateData.fields };

    // Handle linked records
    if (param.templateData.linked_records) {
      for (const [fieldId, config] of Object.entries(
        param.templateData.linked_records as Record<string, any>,
      )) {
        const linkedConfig = config as any;

        if (linkedConfig.mode === 'existing') {
          // Link to existing records
          recordData[fieldId] = linkedConfig.existing_ids;
        } else if (
          linkedConfig.mode === 'create_new' &&
          linkedConfig.create_configs
        ) {
          // Create nested records recursively
          const nestedIds: string[] = [];

          for (const nestedConfig of linkedConfig.create_configs) {
            // Get the linked model
            const column = await Column.get(param.context, {
              colId: fieldId,
            });
            if (!column || !column.colOptions) {
              continue;
            }

            const linkedModelId = (column.colOptions as any)
              .fk_related_model_id;
            const linkedModel = await Model.get(
              param.context,
              linkedModelId,
            );

            if (!linkedModel) {
              continue;
            }

            // Recursively create nested record
            const nestedId = await this.createRecordRecursive({
              context: param.context,
              model: linkedModel,
              templateData: nestedConfig,
              userId: param.userId,
              req: param.req,
              depth: depth + 1,
            });

            nestedIds.push(nestedId);
          }

          // Link the newly created nested records
          if (nestedIds.length > 0) {
            recordData[fieldId] = nestedIds;
          }
        }
      }
    }

    // Create the record using DatasService
    const result = await this.datasService.dataInsert(param.context, {
      baseName: param.model.base_id,
      tableName: param.model.id,
      body: recordData,
      cookie: param.req,
      query: {},
    });

    // Return the created record's ID
    return result?.Id || result?.id || result;
  }
}
