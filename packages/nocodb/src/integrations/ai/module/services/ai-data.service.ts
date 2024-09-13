import { Injectable } from '@nestjs/common';
import { ButtonActionsType, UITypes } from 'nocodb-sdk';

import { z } from 'zod';
import type { NcContext, NcRequest } from '~/interface/config';
import type AiIntegration from '~/integrations/ai/ai.interface';
import type { AIColumn, ButtonColumn, Column } from '~/models';
import Model from '~/models/Model';

import { TablesService } from '~/services/tables.service';
import { DataTableService } from '~/services/data-table.service';
import { Integration, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class AiDataService {
  constructor(
    protected readonly tablesService: TablesService,
    private readonly dataTableService: DataTableService,
  ) {}

  async generateRows(
    context: NcContext,
    params: {
      modelId: string;
      columnId: string;
      rowIds: string[];
      req: NcRequest;
    },
  ) {
    const { modelId, columnId, rowIds, req } = params;

    if (!rowIds.length) {
      return [];
    }

    if (rowIds.length > 25) {
      NcError.badRequest('Only 25 rows can be processed at a time!');
    }

    const model = await Model.get(context, modelId);

    if (!model) {
      NcError.tableNotFound(modelId);
    }

    await model.getColumns(context);

    const column = model.columnsById[columnId];

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    if (column.uidt !== UITypes.AI && column.uidt !== UITypes.Button) {
      NcError.unprocessableEntity('Only AI columns are supported');
    }

    if (column.uidt === UITypes.Button) {
      return this.generateFromButton(context, {
        model,
        column,
        rowIds,
        req,
      });
    }

    const ai = await column.getColOptions<AIColumn>(context);

    if (!ai) {
      NcError.unprocessableEntity('AI column not found');
    }

    if (ai.prompt.includes(`${column.id}`)) {
      NcError.unprocessableEntity('Circular reference not allowed');
    }

    const promptTemplate = ai.prompt.replace(/{(.*?)}/g, (match, p1) => {
      const column = model.columnsById[p1];

      if (!column) {
        NcError.badRequest(`Field '${p1}' not found`);
      }

      return `{${column.title}}`;
    });

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const records = await baseModel.list(
      {
        pks: rowIds.join(','),
      },
      {
        ignoreViewFilterAndSort: true,
      },
    );

    const userMessage = JSON.stringify(
      records.map((row) => {
        const pkObj = baseModel.model.primaryKeys.reduce((acc, pk) => {
          acc[pk.title] = row[pk.title];
          return acc;
        }, {});

        return {
          [column.title]: promptTemplate.replace(/{(.*?)}/g, (match, p1) => {
            return row[p1];
          }),
          ...pkObj,
        };
      }),
    );

    const integration = await Integration.get(context, ai.fk_integration_id);

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject<{
      rows: { [key: string]: string }[];
    }>({
      schema: z.object({
        rows: z.array(
          z.object({
            [column.title]: z.string(),
            ...Object.fromEntries(
              baseModel.model.primaryKeys.map((pk) => [pk.title, z.any()]),
            ),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet assistant.
          You are given a list of prompts as JSON array.
          You need to generate a list of responses as JSON array.
          Avoid modifying following fields: ${baseModel.model.primaryKeys
            .map((pk) => `"${pk.title}"`)
            .join(', ')}.

          Sample Input:
          \`\`\`json
          [
            { "Id": 1, "fieldName": "What is the capital of France?" },
            { "Id": 2, "fieldName": "What is the capital of Germany?" }
          ]
          \`\`\`

          Sample Output:
          \`\`\`json
          [
            { "Id": 1, "fieldName": "Paris" },
            { "Id": 2, "fieldName": "Berlin" }
          ]
          \`\`\`
          `,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      ...(ai.model ? { customModel: ai.model } : {}),
    });

    await integration.storeInsert(context, req?.user?.id, usage);

    const { rows } = data;

    const updatedRows = await baseModel.bulkUpdate(rows, {
      cookie: {
        ...req,
        system: true,
      },
    });

    return updatedRows;
  }

  async generateFromButton(
    context: NcContext,
    params: {
      model: Model;
      column: Column;
      rowIds: string[];
      req: NcRequest;
    },
  ) {
    const { model, column, rowIds, req } = params;

    if (!rowIds.length) {
      return [];
    }

    if (rowIds.length > 25) {
      NcError.badRequest('Only 25 rows can be processed at a time!');
    }

    if ((column.colOptions as ButtonColumn).type !== ButtonActionsType.Ai) {
      NcError.unprocessableEntity('Only AI buttons are supported');
    }

    const aiButton = await column.getColOptions<ButtonColumn>(context);

    if (!aiButton) {
      NcError.unprocessableEntity('AI Button is not configured properly');
    }

    if (aiButton.formula.includes(`${column.id}`)) {
      NcError.unprocessableEntity('Circular reference not allowed');
    }

    const promptTemplate = aiButton.formula.replace(/{(.*?)}/g, (match, p1) => {
      const column = model.columnsById[p1];

      if (!column) {
        NcError.badRequest(`Field '${p1}' not found`);
      }

      return `{${column.title}}`;
    });

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const records = await baseModel.list(
      {
        pks: rowIds.join(','),
      },
      {
        ignoreViewFilterAndSort: true,
      },
    );

    const userMessage = JSON.stringify(
      records.map((row) => {
        const pkObj = baseModel.model.primaryKeys.reduce((acc, pk) => {
          acc[pk.title] = row[pk.title];
          return acc;
        }, {});

        return {
          [column.title]: promptTemplate.replace(/{(.*?)}/g, (match, p1) => {
            return row[p1];
          }),
          ...pkObj,
        };
      }),
    );

    const outputColumnIds = aiButton.output_column_ids?.split(',') || [];

    const outputColumns = outputColumnIds.map((id) => model.columnsById[id]);

    const integration = await Integration.get(
      context,
      aiButton.fk_integration_id,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject<{
      rows: { [key: string]: string }[];
    }>({
      schema: z.object({
        rows: z.array(
          z.object({
            ...Object.fromEntries(
              outputColumns.map((col) => [col.title, z.any()]),
            ),
            ...Object.fromEntries(
              baseModel.model.primaryKeys.map((pk) => [pk.title, z.any()]),
            ),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet assistant.
          You are given a list of prompts as JSON array.
          You need to generate a list of responses as JSON array.
          Avoid modifying following fields (primary keys): ${baseModel.model.primaryKeys
            .map((pk) => `"${pk.title}"`)
            .join(', ')}.

          In response you must return following fields along with the primary keys: ${outputColumns
            .map((col) => `"${col.title}"`)
            .join(', ')}.

          Sample Input:
          \`\`\`json
          [
            { "Id": 1, "question": "What is the capital of France?" },
            { "Id": 2, "question": "What is the capital of Germany?" }
          ]
          \`\`\`

          Sample Output:
          \`\`\`json
          [
            { "Id": 1, "answer": "Paris" },
            { "Id": 2, "answer": "Berlin" }
          ]
          \`\`\`
          `,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      ...(aiButton.model ? { customModel: aiButton.model } : {}),
    });

    await integration.storeInsert(context, req?.user?.id, usage);

    const { rows } = data;

    const updatedRows = await baseModel.bulkUpdate(rows, {
      cookie: {
        ...req,
        system: true,
      },
    });

    return updatedRows;
  }
}
