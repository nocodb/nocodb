import { Injectable } from '@nestjs/common';
import { IntegrationCategoryType, UITypes } from 'nocodb-sdk';

import { z } from 'zod';
import type { NcContext, NcRequest } from '~/interface/config';
import type AiIntegration from '~/integrations/ai/ai.interface';
import type { AIColumn } from '~/models';
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

    const column = model.columns.find((c) => c.id === columnId);

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    if (column.uidt !== UITypes.AI) {
      NcError.unprocessableEntity('Only AI columns are supported');
    }

    const ai = await column.getColOptions<AIColumn>(context);

    if (!ai) {
      NcError.unprocessableEntity('AI column not found');
    }

    if (ai.prompt.includes(`${column.id}`)) {
      NcError.unprocessableEntity('Circular reference not allowed');
    }

    const promptTemplate = ai.prompt.replace(/{(.*?)}/g, (match, p1) => {
      const column = model.columns.find((c) => c.id === p1);

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
}
