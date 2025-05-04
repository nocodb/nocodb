import { Injectable } from '@nestjs/common';
import {
  ButtonActionsType,
  IntegrationCategoryType,
  isSystemColumn,
  isVirtualCol,
  type PredictNextFieldsType,
  type PredictNextFormulasType,
  UITypes,
} from 'nocodb-sdk';
import { z } from 'zod';
import type { NcContext } from '~/interface/config';
import type { AiIntegration } from '@noco-integrations/core';
import { Base, Integration, Model } from '~/models';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';
import {
  buttonsSystemMessage,
  formulasSystemMessage,
  predictFieldTypePrompt,
  predictFieldTypeSystemMessage,
  predictFormulaPrompt,
  predictNextButtonsPrompt,
  predictNextFieldsPrompt,
  predictNextFieldsSystemMessage,
  predictNextFormulasPrompt,
  predictNextTablesPrompt,
  predictNextTablesSystemMessage,
  predictSelectOptionsPrompt,
  predictSelectOptionsSystemMessage,
  repairFormulaPrompt,
} from '~/integrations/ai/module/prompts';

@Injectable()
export class AiUtilsService {
  constructor(protected readonly aiSchemaService: AiSchemaService) {}

  async predictFieldType(
    context: NcContext,
    params: {
      input: string;
      req?: any;
    },
  ) {
    const { input } = params;

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        type: z.enum([
          'SingleLineText',
          'LongText',
          'Lookup',
          'Attachment',
          'Checkbox',
          'MultiSelect',
          'SingleSelect',
          'Date',
          'Year',
          'Time',
          'PhoneNumber',
          'GeoData',
          'Email',
          'URL',
          'Number',
          'Decimal',
          'Currency',
          'Percent',
          'Duration',
          'Rating',
          'Formula',
          'Rollup',
          'DateTime',
          'JSON',
          'Barcode',
          'QrCode',
          'Button',
          'Links',
          'User',
          'CreatedBy',
          'LastModifiedBy',
        ]),
      }),
      messages: [
        {
          role: 'system',
          content: predictFieldTypeSystemMessage(),
        },
        {
          role: 'user',
          content: predictFieldTypePrompt(input),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return data;
  }

  async predictSelectOptions(
    context: NcContext,
    params: {
      input: {
        title: string;
        tableId: string;
        history?: string[];
      };
      req?: any;
    },
  ) {
    const { title, tableId } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    const columns = await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        options: z.array(z.string()),
      }),
      messages: [
        {
          role: 'system',
          content: predictSelectOptionsSystemMessage(),
        },
        {
          role: 'user',
          content: predictSelectOptionsPrompt(
            model.title,
            title,
            columns.map((c) => c.title),
            params.input.history,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return data;
  }

  async predictNextFields(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        history?: string[];
        description?: string;
        unsupportedColumn?: string[];
      };
      req?: any;
    },
  ) {
    const { tableId } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    const unsupportedColumn = params.input.unsupportedColumn || [];

    const columns = await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject<{
      fields: PredictNextFieldsType[];
    }>({
      schema: z.object({
        fields: z.array(
          z.object({
            title: z.string(),
            type: z.string(),
            options: z.array(z.string()).optional().default([]),
            description: z.string().nullable().optional(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: predictNextFieldsSystemMessage(unsupportedColumn),
        },
        {
          role: 'user',
          content: predictNextFieldsPrompt(
            model.title,
            columns.map((c) => c.title),
            params.input.history,
            params.input.description,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    // Filter out duplicate fields
    {
      const resFields = data.fields || [];

      const existingFields = [
        ...columns.map((t) => t.title),
        ...(params.input.history || []),
      ];

      data.fields = resFields.filter((f) => {
        return (
          !existingFields.includes(f.title) &&
          !unsupportedColumn.includes(f.type)
        );
      });
    }

    return data;
  }

  async predictNextFormulas(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        history?: string[];
        description?: string;
      };
      req?: any;
    },
  ) {
    const { tableId } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    const columns = await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject<{
      formulas: PredictNextFormulasType[];
    }>({
      schema: z.object({
        formulas: z.array(
          z.object({
            title: z.string(),
            formula: z.string(),
            description: z.string().nullable().optional(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: formulasSystemMessage(
            columns.filter((c) => !isVirtualCol(c)).map((c) => c.title),
          ),
        },
        {
          role: 'user',
          content: predictNextFormulasPrompt(
            model.title,
            columns
              .filter((c) => !isVirtualCol(c) || c.uidt === UITypes.Formula)
              .map((c) => c.title),
            params.input.history,
            params.input.description,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    // Filter out duplicate fields
    {
      const resFields = data.formulas || [];

      const existingFields = [
        ...columns.map((t) => t.title),
        ...(params.input.history || []),
      ];

      data.formulas = resFields.filter(
        (f) => !existingFields.includes(f.title),
      );
    }

    return data;
  }

  async predictNextButtons(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        history?: string[];
        description?: string;
      };
      req?: any;
    },
  ) {
    const { tableId } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    const columns = await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject<{
      buttons: {
        title: string;
        dynamic_input: string;
        output_columns: string;
      }[];
    }>({
      schema: z.object({
        buttons: z.array(
          z.object({
            title: z.string(),
            dynamic_input: z.string(),
            output_columns: z.string(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: buttonsSystemMessage(
            columns
              .filter((c) => !isVirtualCol(c) && !isSystemColumn(c))
              .map((c) => {
                return {
                  title: c.title,
                  uidt: c.uidt,
                };
              }),
          ),
        },
        {
          role: 'user',
          content: predictNextButtonsPrompt(
            model.title,
            columns
              .filter((c) => !isVirtualCol(c) && !isSystemColumn(c))
              .map((c) => c.title),
            params.input.history,
            params.input.description,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    for (const button of data.buttons) {
      // replace column names with column ids
      const outputColumns = button.output_columns
        .split(',')
        .map((col) => {
          const column = columns.find((c) => c.title === col.trim());
          return column ? column.id : null;
        })
        .filter((col) => col !== null)
        .join(',');

      Object.assign(button, {
        uidt: 'Button',
        type: ButtonActionsType.Ai,
        formula_raw: button.dynamic_input,
        output_column_ids: outputColumns,
      });
    }

    // Filter out duplicate fields
    {
      const resFields = data.buttons || [];

      const existingFields = [
        ...columns.map((t) => t.title),
        ...(params.input.history || []),
      ];

      data.buttons = resFields.filter((f) => !existingFields.includes(f.title));
    }

    return data;
  }

  async predictNextTables(
    context: NcContext,
    params: {
      input: {
        history?: string[];
        prompt?: string;
      };
      req?: any;
    },
  ) {
    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const base = await Base.get(context, context.base_id);

    if (!base) {
      throw new Error('Base not found');
    }

    const tables = await Model.list(context, {
      base_id: context.base_id,
      source_id: undefined,
    });

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        tables: z.array(z.string()),
      }),
      messages: [
        {
          role: 'system',
          content: predictNextTablesSystemMessage(),
        },
        {
          role: 'user',
          content: predictNextTablesPrompt(
            base.title,
            tables.map((t) => t.title),
            params.input.history,
            params.input.prompt,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    // Filter out duplicate tables
    {
      const resTables = (data as { tables: string[] }).tables || [];

      const existingTables = [
        ...tables.map((t) => t.title),
        ...(params.input.history || []),
      ];

      (data as { tables: string[] }).tables = resTables.filter(
        (t) => !existingTables.includes(t),
      );
    }

    return data;
  }

  async predictFormula(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        input: string;
        formula?: string;
      };
      req?: any;
    },
  ) {
    const { tableId, input, formula } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    const columns = await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        formula: z.string(),
      }),
      messages: [
        {
          role: 'system',
          content: formulasSystemMessage(columns.map((c) => c.title)),
        },
        {
          role: 'user',
          content: predictFormulaPrompt(input, formula),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return data;
  }

  async repairFormula(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        formula: string;
        error?: string;
      };
      req?: any;
    },
  ) {
    const { tableId, formula, error } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    const columns = await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        formula: z.string(),
      }),
      messages: [
        {
          role: 'system',
          content: formulasSystemMessage(columns.map((c) => c.title)),
        },
        {
          role: 'user',
          content: repairFormulaPrompt(formula, error),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return data;
  }
}
