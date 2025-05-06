import path from 'path';
import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import {
  ButtonActionsType,
  IntegrationsType,
  isSystemColumn,
  isVirtualCol,
  LongTextAiMetaProp,
  UITypes,
} from 'nocodb-sdk';
import mime from 'mime/lite';

import { z } from 'zod';
import type { FileType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type AiIntegration from '~/integrations/ai/ai.interface';
import type { AIColumn, ButtonColumn, Column } from '~/models';
import Model from '~/models/Model';

import { TablesService } from '~/services/tables.service';
import { Integration, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import {
  extractRowsSystemMessage,
  generateFillDataSystemMessage,
  generateFromButtonSystemMessage,
  generateRowsSystemMessage,
} from '~/integrations/ai/module/prompts';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';
import { serialize } from '~/helpers/serialize';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';

const FILE_SEARCH_SUPPORTED_MIMETYPES = [
  'text/x-c',
  'text/x-c++',
  'text/css',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/x-java',
  'text/javascript',
  'application/json',
  'text/markdown',
  'application/pdf',
  'text/x-php',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/x-python',
  'text/x-script.python',
  'text/x-ruby',
  'text/x-tex',
  'application/typescript',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/xml',
];

const INLINE_SUPPORTED_MIMETYPES = [
  'image/*',
  'text/*',
  'application/pdf',
  'application/json',
  'application/xml',
];

const uidtHelper = (cols: Column[]) => {
  let userMessageAddition = '';
  const schema = cols.map((col) => {
    if (col.uidt === UITypes.SingleSelect) {
      userMessageAddition += `\n"${
        col.title
      }" must be one and only one of the following options or null. options:${col.colOptions.options
        .map((o) => `"${o.title}"`)
        .join(',')}`;

      return [
        col.title,
        z
          .enum(col.colOptions.options.map((o) => o.title))
          .nullable()
          .optional(),
      ];
    } else if (col.uidt === UITypes.MultiSelect) {
      userMessageAddition += `\n"${
        col.title
      }" must be a comma separated string only using options (like:opt1,opt2,opt3) or null. options:${col.colOptions.options
        .map((o) => `"${o.title}"`)
        .join(',')}`;

      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.Checkbox) {
      userMessageAddition += `\n"${col.title}" must be a boolean or null`;

      return [col.title, z.boolean().nullable().optional()];
    } else if (col.uidt === UITypes.Number) {
      userMessageAddition += `\n"${col.title}" must be a number (no thousand separator & "," as decimal separator) or null`;

      return [col.title, z.number().nullable().optional()];
    } else if (col.uidt === UITypes.Currency) {
      const currency_code = col.meta?.currency_code || 'USD';

      userMessageAddition += `\n"${col.title}" must be a number or null representing value in ${currency_code}`;

      return [col.title, z.number().nullable().optional()];
    } else if (col.uidt === UITypes.URL) {
      userMessageAddition += `\n"${col.title}" must be a valid URL or null`;

      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.Date) {
      userMessageAddition += `\n"${col.title}" must be a valid date in format YYYY-MM-DD or null`;

      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.DateTime) {
      userMessageAddition += `\n"${col.title}" must be a valid date-time in format YYYY-MM-DD HH:mm:ss or null`;

      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.SingleLineText) {
      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.Email) {
      userMessageAddition += `\n"${col.title}" must be a valid email or null`;

      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.PhoneNumber) {
      userMessageAddition += `\n"${col.title}" must be a valid phone number or null`;

      return [col.title, z.string().nullable().optional()];
    } else if (col.uidt === UITypes.LongText) {
      userMessageAddition += `\n"${col.title}" must be a string with rich text support or null`;

      return [col.title, z.string().nullable().optional()];
    }
    return [col.title, z.any().optional()];
  });

  return { schema, userMessageAddition };
};

const prepareAttachments = async (referencedColumns, records) => {
  const atCols = referencedColumns.filter(
    (col) => col.uidt === UITypes.Attachment,
  );

  const allAttachments = [];

  for (const record of records) {
    for (const col of atCols) {
      for (const at of record[col.title] || []) {
        let relativePath;

        if (at.path) {
          relativePath = path.join(
            'nc',
            'uploads',
            at.path.replace(/^download[/\\]/i, ''),
          );
        } else if (at.url) {
          relativePath = getPathFromUrl(at.url).replace(/^\/+/, '');
        }

        const attachment = {
          ...at,
          mimetype:
            at.mimetype !== 'application/octet-stream'
              ? at.mimetype
              : mime.getType(at.path || at.url),
          colId: col.id,
          relativePath,
        };

        if (
          INLINE_SUPPORTED_MIMETYPES.some((m) =>
            attachment.mimetype?.match(new RegExp(m.replace('*', '.*'))),
          )
        ) {
          allAttachments.push(attachment);
        }
      }
    }
  }

  const imageAttachments = [];

  const otherAttachments = [];

  for (const attachment of allAttachments) {
    if (attachment.mimetype?.match(/image\/*/)) {
      imageAttachments.push(attachment);
    } else {
      otherAttachments.push(attachment);
    }
  }

  const storageAdapter = await NcPluginMgrv2.storageAdapter();

  const encodedImages = [];

  for (const attachment of imageAttachments) {
    const file = await storageAdapter.fileRead(attachment.relativePath);

    // convert file to base64
    // const base64 = file.toString('base64');

    encodedImages.push({
      type: 'image',
      image: file,
    });
  }

  const inlineAttachments: Record<string, string[]> = {};

  for (const attachment of otherAttachments) {
    const fileStream = await storageAdapter.fileReadByStream(
      attachment.relativePath,
    );
    const serialized = await serialize(attachment.mimetype, fileStream);

    if (serialized) {
      if (!inlineAttachments[attachment.colId]) {
        inlineAttachments[attachment.colId] = [];
      }

      inlineAttachments[attachment.colId].push(serialized.text);
      encodedImages.push(...serialized.images);
    }
  }

  return { encodedImages, inlineAttachments };
};

const preparePromptAttachments = async (
  files: { buffer: string; mimetype: string }[],
) => {
  const encodedImages = [];

  const inlineAttachments = [];

  for (const file of files) {
    if (
      !INLINE_SUPPORTED_MIMETYPES.some((m) =>
        file.mimetype?.match(new RegExp(m.replace('*', '.*'))),
      )
    )
      continue;

    if (file.mimetype.match(/image\/*/)) {
      encodedImages.push({
        type: 'image',
        image: file.buffer,
      });
      continue;
    }

    const serialized = await serialize(
      file.mimetype,
      Readable.from(file.buffer),
    );

    if (serialized) {
      inlineAttachments.push(serialized.text);
      encodedImages.push(...serialized.images);
    }
  }

  return { encodedImages, inlineAttachments };
};

@Injectable()
export class AiDataService {
  constructor(
    protected readonly tablesService: TablesService,
    protected readonly aiSchemaService: AiSchemaService,
  ) {}

  async generateRows(
    context: NcContext,
    params: {
      modelId: string;
      rowIds?: string[];
      rows?: { [key: string]: any }[];
      req: NcRequest;
      columnId?: string;
      aiPayload?: {
        title: string;
        prompt_raw: string;
        fk_integration_id: string;
        uidt: UITypes.LongText | UITypes.Button;
        output_column_ids?: string;
        model?: string;
      };
      preview?: boolean;
    },
  ) {
    const {
      modelId,
      columnId,
      aiPayload,
      rowIds = [],
      rows = [],
      req,
      preview = false,
    } = params;

    if (!rowIds.length && !rows.length) {
      return [];
    }

    if (rowIds.length && rows.length) {
      NcError.badRequest('Either rowIds or rows should be provided');
    }

    if (rowIds.length > 25 || rows.length > 25) {
      NcError.badRequest('Only 25 rows can be processed at a time!');
    }

    const model = await Model.get(context, modelId);

    if (!model) {
      NcError.tableNotFound(modelId);
    }

    await model.getColumns(context);

    let ai: Partial<AIColumn>;
    let returnTitle: string;

    if (columnId) {
      const column = model.columnsById[columnId];

      if (!column) {
        NcError.fieldNotFound(columnId);
      }

      if (
        (column.uidt !== UITypes.Button && column.uidt !== UITypes.LongText) ||
        (column.uidt === UITypes.LongText &&
          column.meta?.[LongTextAiMetaProp] !== true)
      ) {
        NcError.unprocessableEntity('Only AI columns are supported');
      }

      returnTitle = column.title;

      if (column.uidt === UITypes.Button) {
        return this.generateFromButton(context, {
          model,
          column,
          rowIds,
          rows,
          preview,
          req,
        });
      }

      ai = (await column.getColOptions<any>(context)) as AIColumn;

      if (!ai) {
        NcError.unprocessableEntity('AI column not found');
      }

      if (ai.prompt.includes(`${column.id}`)) {
        NcError.unprocessableEntity('Circular reference not allowed');
      }
    } else if (aiPayload) {
      ai = aiPayload;

      if (aiPayload.uidt === UITypes.Button) {
        return this.generateFromButton(context, {
          model,
          aiPayload: aiPayload as any, // TODO: fix this - type must match but ts not picking it up
          rowIds,
          preview,
          req,
        });
      }

      returnTitle = aiPayload.title;

      ai.prompt = ai.prompt_raw.replace(/{(.*?)}/g, (match, p1) => {
        const col = model.columns.find((c) => c.title === p1);

        if (!col) {
          NcError.badRequest(`Field '${p1}' not found`);
        }

        return `{${col.id}}`;
      });
    } else {
      NcError.badRequest('Column or AI payload is required');
    }

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const records = rowIds.length
      ? await baseModel.list(
          {
            pks: rowIds.join(','),
          },
          {
            ignoreViewFilterAndSort: true,
            ignorePagination: true,
          },
        )
      : rows;

    const integration = await Integration.get(context, ai.fk_integration_id);

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const referencedColumns: Column[] = [];

    // get all referenced columns from the prompt
    ai.prompt.replace(/{(.*?)}/g, (match, p1) => {
      const col = model.columnsById[p1];

      if (!col) {
        NcError.badRequest(`Field '${p1}' not found`);
      }

      referencedColumns.push(col);

      return p1;
    });

    const { encodedImages, inlineAttachments } = await prepareAttachments(
      referencedColumns,
      records,
    );

    const userMessage = JSON.stringify(
      records.map((row) => {
        const pkObj = baseModel.model.primaryKeys.reduce((acc, pk) => {
          if (row[pk.title]) {
            acc[pk.title] = row[pk.title];
          }
          return acc;
        }, {});

        let imageCounter = 1;

        return {
          [returnTitle]: ai.prompt.replace(/{(.*?)}/g, (match, p1) => {
            const col = model.columnsById[p1];

            if (!col) {
              NcError.badRequest(`Field '${p1}' not found`);
            }

            if (col.uidt === UITypes.Attachment) {
              if (inlineAttachments[col.id]) {
                return inlineAttachments[col.id]
                  .map((i) => `\n\nFile:\n\`\`\`${i}\n\`\`\`\n`)
                  .join('');
              }

              if (encodedImages.length) {
                return `"attached image #${imageCounter++}"`;
              }

              return 'no image attached';
            }

            return row[col.title];
          }),
          ...pkObj,
        };
      }),
    );

    const pkSchema = records.every((r) => {
      return baseModel.model.primaryKeys.every((pk) => r[pk.title]);
    })
      ? Object.fromEntries(
          baseModel.model.primaryKeys.map((pk) => [
            pk.title,
            z.string().or(z.number()),
          ]),
        )
      : {};

    const { data, usage } = await wrapper.generateObject<{
      rows: { [key: string]: string }[];
    }>({
      schema: z.object({
        rows: z.array(
          z.object({
            [returnTitle]: z.string(),
            ...pkSchema,
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: generateRowsSystemMessage(
            baseModel.model.primaryKeys.map((pk) => pk.title),
          ),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userMessage,
            },
            ...(encodedImages.length ? encodedImages : []),
          ],
        },
      ],
      ...(ai.model ? { customModel: ai.model } : {}),
    });

    await integration.storeInsert(context, req?.user?.id, usage);

    const { rows: returnRows } = data;

    if (preview || aiPayload || rows.length) {
      return returnRows;
    }

    const updatedRows = await baseModel.bulkUpdate(returnRows, {
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
      rowIds?: string[];
      rows?: { [key: string]: any }[];
      req: NcRequest;
      column?: Column;
      aiPayload?: {
        title: string;
        prompt_raw: string;
        fk_integration_id: string;
        uidt: UITypes.Button;
        output_column_ids?: string;
        model?: string;
      };
      preview?: boolean;
    },
  ) {
    const {
      model,
      column,
      aiPayload,
      rowIds = [],
      rows = [],
      req,
      preview = false,
    } = params;

    if (!rowIds.length && !rows.length) {
      return [];
    }

    if (rowIds.length > 25 || rows.length > 25) {
      NcError.badRequest('Only 25 rows can be processed at a time!');
    }

    if (rowIds.length && rows.length) {
      NcError.badRequest('Either rowIds or rows should be provided');
    }

    let aiButton: Partial<ButtonColumn>;
    let buttonTitle: string;

    if (column) {
      if ((column.colOptions as ButtonColumn).type !== ButtonActionsType.Ai) {
        NcError.unprocessableEntity('Only AI buttons are supported');
      }

      aiButton = await column.getColOptions<ButtonColumn>(context);

      buttonTitle = column.title;

      if (aiButton.formula.includes(`${column.id}`)) {
        NcError.unprocessableEntity('Circular reference not allowed');
      }
    } else if (aiPayload) {
      if (aiPayload.uidt !== UITypes.Button) {
        NcError.unprocessableEntity('Only AI buttons are supported');
      }

      buttonTitle = aiPayload.title;

      aiButton = {
        ...aiPayload,
        formula_raw: aiPayload.prompt_raw,
      };

      aiButton.formula = aiButton.formula_raw.replace(
        /{(.*?)}/g,
        (match, p1) => {
          const col = model.columns.find((c) => c.title === p1);

          if (!col) {
            NcError.badRequest(`Field '${p1}' not found`);
          }

          return `{${col.id}}`;
        },
      );
    }

    if (!aiButton) {
      NcError.unprocessableEntity('AI Button is not configured properly');
    }

    const referencedColumns: Column[] = [];

    // get all referenced columns from the prompt
    aiButton.formula.replace(/{(.*?)}/g, (match, p1) => {
      const col = model.columnsById[p1];

      if (!col) {
        NcError.badRequest(`Field '${p1}' not found`);
      }

      referencedColumns.push(col);

      return p1;
    });

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const records = rowIds.length
      ? await baseModel.list(
          {
            pks: rowIds.join(','),
          },
          {
            ignoreViewFilterAndSort: true,
            ignorePagination: true,
          },
        )
      : rows;

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

    const { encodedImages, inlineAttachments } = await prepareAttachments(
      referencedColumns,
      records,
    );

    let userMessage = JSON.stringify(
      records.map((row) => {
        const pkObj = baseModel.model.primaryKeys.reduce((acc, pk) => {
          if (row[pk.title]) {
            acc[pk.title] = row[pk.title];
          }
          return acc;
        }, {});

        let imageCounter = 1;

        return {
          [buttonTitle]: aiButton.formula.replace(/{(.*?)}/g, (match, p1) => {
            const col = model.columnsById[p1];

            if (!col) {
              NcError.badRequest(`Field '${p1}' not found`);
            }

            if (col.uidt === UITypes.Attachment) {
              if (inlineAttachments[col.id]) {
                return inlineAttachments[col.id]
                  .map((i) => `\n\nFile:\n\`\`\`${i}\n\`\`\`\n`)
                  .join('');
              }

              if (encodedImages.length) {
                return `"attached image #${imageCounter++}"`;
              }

              return 'no image attached';
            }

            return row[col.title];
          }),
          ...pkObj,
        };
      }),
    );

    const uidtHelp = uidtHelper(outputColumns);

    userMessage += uidtHelp.userMessageAddition
      ? `\nColumn Rules:\nIf options are provided strictly use them & custom values are restricted\n${uidtHelp.userMessageAddition}`
      : '';

    const pkSchema = records.every((r) => {
      return baseModel.model.primaryKeys.every((pk) => r[pk.title]);
    })
      ? Object.fromEntries(
          baseModel.model.primaryKeys.map((pk) => [
            pk.title,
            z.string().or(z.number()),
          ]),
        )
      : {};

    const res = await wrapper.generateObject<{
      rows: { [key: string]: string }[];
    }>({
      schema: z.object({
        rows: z.array(
          z.object({
            ...Object.fromEntries(uidtHelp.schema),
            ...pkSchema,
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: generateFromButtonSystemMessage(
            baseModel.model.primaryKeys.map((pk) => pk.title),
            outputColumns.map((col) => col.title),
          ),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userMessage,
            },
            ...(encodedImages.length ? encodedImages : []),
          ],
        },
      ],
      ...(aiButton.model ? { customModel: aiButton.model } : {}),
    });

    const data = res.data;
    const usage = res.usage;

    await integration.storeInsert(context, req?.user?.id, usage);

    const { rows: returnRows } = data;

    if (preview || aiPayload || rows.length) {
      return returnRows;
    }

    try {
      const updatedRows = await baseModel.bulkUpdate(returnRows, {
        cookie: {
          ...req,
          system: true,
        },
      });

      return updatedRows;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async generateFillData(
    context: NcContext,
    params: {
      modelId: string;
      rows: { [key: string]: any }[];
      generateIds: string[];
      numRows: number;
      req: NcRequest;
    },
  ) {
    const { modelId, rows = [], generateIds, req } = params;

    if (!rows.length) {
      return [];
    }

    if (generateIds.length > 25 || rows.length > 25) {
      NcError.badRequest('Only 25 rows can be processed at a time!');
    }

    const model = await Model.get(context, modelId);

    if (!model) {
      NcError.tableNotFound(modelId);
    }

    await model.getColumns(context);

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationsType.Ai,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const selectedColumns = model.columns.filter((col) => {
      return rows[0]?.[col.title] !== undefined;
    });

    const allowedColumns = selectedColumns.filter(
      (col) =>
        col.uidt === UITypes.ID ||
        (![UITypes.Attachment].includes(col.uidt) &&
          !isSystemColumn(col) &&
          !isVirtualCol(col)),
    );

    const uidtHelp = uidtHelper(allowedColumns);

    const filteredRows = rows.map((row) => {
      return Object.fromEntries(
        Object.entries(row).filter(([key]) =>
          allowedColumns.map((c) => c.title).includes(key),
        ),
      );
    });

    const { data, usage } = await wrapper.generateObject<{
      rows: { [key: string]: string }[];
    }>({
      schema: z.object({
        rows: z.array(
          z.object({
            ...Object.fromEntries(uidtHelp.schema),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: generateFillDataSystemMessage(
            JSON.stringify(
              await this.aiSchemaService.serializeSchema(context, {
                baseId: model.base_id,
                req,
              }),
            ),
            uidtHelp.userMessageAddition,
          ),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `User Data:
\`\`\`json
${JSON.stringify(filteredRows, null, 2)}
\`\`\`
Please generate ${
                generateIds.length
              } rows based on them and return as JSON array.`,
            },
          ],
        },
      ],
    });

    await integration.storeInsert(context, req?.user?.id, usage);

    const { rows: returnRows } = data;

    if (returnRows.length > generateIds.length + rows.length) {
      NcError.unprocessableEntity(
        `Expected ${generateIds.length} rows, but received ${returnRows.length}`,
      );
    }

    let rowIndex = 0;

    const rowsWithId = returnRows.map((row) => {
      if (row[baseModel.model.primaryKeys[0].title]) {
        return row;
      }

      return {
        ...row,
        [model.primaryKeys[0].title]: params.generateIds[rowIndex++],
      };
    });

    return rowsWithId;
  }

  async extractRowsFromInput(
    context: NcContext,
    params: {
      modelId: string;
      input: string;
      files: Array<FileType>;
      req: NcRequest;
    },
  ) {
    const { modelId, input, files, req } = params;

    const model = await Model.get(context, modelId);

    if (!model) {
      NcError.tableNotFound(modelId);
    }

    await model.getColumns(context);

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationsType.Ai,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const possibleColumns = model.columns.filter((col) => {
      return (
        !col.system &&
        ![UITypes.ID, UITypes.Attachment].includes(col.uidt) &&
        !isVirtualCol(col)
      );
    });

    const uidtHelp = uidtHelper(possibleColumns);

    const { encodedImages, inlineAttachments } = await preparePromptAttachments(
      files as any,
    );

    const attachmentParts = [];

    if (inlineAttachments) {
      const maxChunkLength = 2048;
      let chunkLength = 0;
      let chunk = '';
      for (const inlineAttachment of inlineAttachments) {
        if (chunkLength + inlineAttachment.length < maxChunkLength) {
          chunk += inlineAttachment;
          chunkLength += inlineAttachment.length;
        } else {
          const splitInput = inlineAttachment.split('\n');
          for (const line of splitInput) {
            if (chunkLength + line.length < maxChunkLength) {
              chunk += line;
              chunkLength += line.length;
            } else {
              attachmentParts.push(chunk);
              chunk = line;
              chunkLength = line.length;
            }
          }
        }
      }
      if (chunk) {
        attachmentParts.push(chunk);
      }
    }

    const userMessages = attachmentParts.length
      ? attachmentParts.map(
          (pt) => `${input}${`\n\nFile:\n\`\`\`${pt}\n\`\`\`\n`}`,
        )
      : [input];

    const rows = [];
    const totalUsage = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      model: '',
    };

    for (const userMessage of userMessages) {
      const { data, usage } = await wrapper.generateObject<{
        rows: { [key: string]: string }[];
      }>({
        schema: z.object({
          rows: z.array(
            z.object({
              ...Object.fromEntries(uidtHelp.schema),
            }),
          ),
        }),
        messages: [
          {
            role: 'system',
            content: extractRowsSystemMessage(
              possibleColumns.map((c) => c.title),
              uidtHelp.userMessageAddition,
            ),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage,
              },
              ...(encodedImages.length ? encodedImages : []),
            ],
          },
        ],
      });

      rows.push(...data.rows);

      totalUsage.input_tokens += usage.input_tokens;
      totalUsage.output_tokens += usage.output_tokens;
      totalUsage.total_tokens += usage.total_tokens;
      totalUsage.model = usage.model;
    }

    await integration.storeInsert(context, req?.user?.id, totalUsage);

    const insertedRows = await baseModel.bulkInsert(rows, {
      cookie: {
        ...req,
        system: true,
      },
    });

    return insertedRows;
  }

  async fileSearch(
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

    if (rowIds.length > 1) {
      NcError.unprocessableEntity(
        'Only single row is supported for file search',
      );
    }

    const referencedColumns: Column[] = [];

    // get all referenced columns from the prompt
    aiButton.formula.replace(/{(.*?)}/g, (match, p1) => {
      const col = model.columnsById[p1];

      if (!col) {
        NcError.badRequest(`Field '${p1}' not found`);
      }

      referencedColumns.push(col);

      return p1;
    });

    // check if any of the referenced columns are attachments
    const attachmentColumns = referencedColumns.filter(
      (col) => col.uidt === UITypes.Attachment,
    );

    if (!attachmentColumns.length) {
      NcError.unprocessableEntity('No attachment columns found in the formula');
    }

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

    let userMessage = JSON.stringify(
      records.map((row) => {
        const pkObj = baseModel.model.primaryKeys.reduce((acc, pk) => {
          acc[pk.title] = row[pk.title];
          return acc;
        }, {});

        return {
          [column.title]: aiButton.formula.replace(/{(.*?)}/g, (match, p1) => {
            const col = model.columnsById[p1];

            if (!col) {
              NcError.badRequest(`Field '${p1}' not found`);
            }

            if (col.uidt === UITypes.Attachment) {
              return '@file';
            }

            return row[col.title];
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

    const attachments = attachmentColumns
      .map((col) => records?.[0]?.[col.title])
      .flat()
      .filter((at) => at);

    for (const attachment of attachments) {
      const mimeType = attachment.mimetype;

      if (!FILE_SEARCH_SUPPORTED_MIMETYPES.includes(mimeType)) {
        NcError.unprocessableEntity(
          `File search is not supported for ${mimeType}`,
        );
      }
    }

    const uidtHelp = uidtHelper(outputColumns);

    userMessage += uidtHelp.userMessageAddition;

    const res = await (wrapper as any).fileSearch({
      schema: z.object({
        ...Object.fromEntries(uidtHelp.schema),
      }),
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      extractFields: outputColumns.map((col) => col.title),
      attachments,
    });

    // add primary keys to the output
    res.data = {
      ...res.data,
      ...Object.fromEntries(
        baseModel.model.primaryKeys.map((pk) => [
          pk.title,
          records[0][pk.title],
        ]),
      ),
    };

    const data = {
      rows: [res.data],
    };
    const usage = res.usage;

    await integration.storeInsert(context, req?.user?.id, usage);

    const { rows } = data;

    try {
      const updatedRows = await baseModel.bulkUpdate(rows, {
        cookie: {
          ...req,
          system: true,
        },
      });

      return updatedRows;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
