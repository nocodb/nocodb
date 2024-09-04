import { Injectable } from '@nestjs/common';
import { IntegrationCategoryType, isVirtualCol, UITypes } from 'nocodb-sdk';
import { z } from 'zod';
import type { NcContext } from '~/interface/config';
import type AiIntegration from '~/integrations/ai/ai.interface';
import { Integration, Model } from '~/models';
import { AiSchemaService } from '~/modules/noco-ai/services/ai-schema.service';

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

    const wrapper =
      (await integration.getIntegrationWrapper()) as AiIntegration;

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
          'CreatedTime',
          'LastModifiedTime',
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
          content: `You are a smart-spreadsheet designer.
          Following column types are available to use:
          SingleLineText, LongText, Lookup, Attachment, Checkbox, MultiSelect, SingleSelect, Date, Year, Time, PhoneNumber, Email, URL, Number, Decimal, Currency, Percent, Duration, Rating, Formula, Rollup, DateTime, CreatedTime, LastModifiedTime, JSON, Barcode, QrCode, Button, Links, User, CreatedBy, LastModifiedBy.`,
        },
        {
          role: 'user',
          content: `Predict most suitable column type for "${input}"`,
        },
      ],
    });

    console.log(`Predict Column Type: ${usage.total} tokens`);

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

    const wrapper =
      (await integration.getIntegrationWrapper()) as AiIntegration;

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        options: z.array(z.string()),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet designer.`,
        },
        {
          role: 'user',
          content: `Predict most suitable select options for following schema:
          Table: ${model.title}
          Field: ${title.length > 3 ? title : 'SelectField'}
          Fields: ${columns.map((c) => c.title).join(', ')}
          ${
            params.input.history
              ? `Existing options: ${params.input.history.join(', ')}`
              : ''
          }`,
        },
      ],
    });

    console.log(`Predict Select Options: ${usage.total} tokens`);

    return data;
  }

  async predictNextFields(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        history?: string[];
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

    const wrapper =
      (await integration.getIntegrationWrapper()) as AiIntegration;

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        fields: z.array(
          z.object({
            title: z.string(),
            type: z.string(),
            options: z.array(z.string()).optional(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet designer.
          Following column types are available to use:
          SingleLineText, LongText, Lookup, Attachment, Checkbox, MultiSelect, SingleSelect, Date, Year, Time, PhoneNumber, Email, URL, Number, Decimal, Currency, Percent, Duration, Rating, Formula, Rollup, DateTime, CreatedTime, LastModifiedTime, JSON, Barcode, QrCode, Button, Links, User, CreatedBy, LastModifiedBy.
          Duplicate columns are not allowed.
          SingleSelect and MultiSelect columns require options.`,
        },
        {
          role: 'user',
          content: `Predict next 3 to 5 column for table "${
            model.title
          }" which already have following columns "${columns
            .map((c) => c.title)
            .concat(params.input.history || [])
            .join(', ')}"`,
        },
      ],
    });

    console.log(`Predict Next Fields: ${usage.total} tokens`);

    return data;
  }

  async predictNextFormulas(
    context: NcContext,
    params: {
      input: {
        tableId: string;
        history?: string[];
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

    const wrapper =
      (await integration.getIntegrationWrapper()) as AiIntegration;

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        formulas: z.array(z.object({ title: z.string(), formula: z.string() })),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet designer.
          NocoDB supports following formula functions:
          Numeric Functions
          ABS(x): Absolute value.
          ADD(x, [y, ...]): Sum.
          AVG(x, [y, ...]): Average.
          CEILING(x): Round up.
          COUNT(x, [y, ...]): Count numbers.
          COUNTA(x, [y, ...]): Count non-empty.
          COUNTALL(x, [y, ...]): Count all.
          EVEN(x): Nearest even number.
          EXP(x): e^x.
          FLOOR(x): Round down.
          INT(x): Integer part.
          LOG(base, x): Logarithm.
          MAX(x, [y, ...]): Maximum.
          MIN(x, [y, ...]): Minimum.
          MOD(x, y): Remainder.
          ODD(x): Nearest odd number.
          POWER(x, y): x^y.
          ROUND(x, [precision]): Round.
          ROUNDDOWN(x, [precision]): Round down.
          ROUNDUP(x, [precision]): Round up.
          SQRT(x): Square root.
          VALUE(str): Convert to number.
          String Functions
          CONCAT(x, [y, ...]): Concatenate.
          LEFT(str, n): Leftmost n chars.
          LEN(str): String length.
          LOWER(str): Lowercase.
          MID(str, pos, [count]): Substring.
          REPEAT(str, n): Repeat n times.
          REPLACE(str, old, new): Replace text.
          RIGHT(str, n): Rightmost n chars.
          SEARCH(str, target): Find position.
          SUBSTR(str, pos, [count]): Substring.
          TRIM(str): Remove spaces.
          UPPER(str): Uppercase.
          URL(str): Convert to URL.
          Date Functions
          NOW(): Current date/time.
          DATEADD(date, n, unit): Add time.
          DATETIME_DIFF(date1, date2, unit): Date difference.
          WEEKDAY(date, [start]): Day of the week.
          Conditional Expressions
          IF(cond, trueVal, falseVal): Conditional logic.
          AND(x, [y, ...]): Logical AND.
          OR(x, [y, ...]): Logical OR.
          
          Each column can be used by wrapping it by curly braces. For example, {column_name}.
          Example: CONCAT({first_name}, ' ', {last_name})`,
        },
        {
          role: 'user',
          content: `Predict next 3 to 5 formula for table "${
            model.title
          }" which already have following columns "${columns
            .filter((c) => !isVirtualCol(c) || c.uidt === UITypes.Formula)
            .map((c) => c.title)
            .concat(params.input.history || [])
            .join(', ')}"`,
        },
      ],
    });

    console.log(`Predict Next Formulas: ${usage.total} tokens`);

    return data;
  }

  async predictNextView(
    context: NcContext,
    params: {
      input: {
        tableId: string;
      };
      req?: any;
    },
  ) {
    const { tableId } = params.input;

    const model = await Model.get(context, tableId);

    if (!model) {
      throw new Error('Model not found');
    }

    await model.getColumns(context);

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper =
      (await integration.getIntegrationWrapper()) as AiIntegration;

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        views: z.array(z.object({ title: z.string(), type: z.string() })),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet designer.
          NocoDB supports following views:
          Table
          Form
          Calendar
          Kanban
          Gallery
          Chart
          Report
          Dashboard
          Each view can be customized with different fields and filters.`,
        },
        {
          role: 'user',
          content: `Predict next 3 to 5 views for table "${model.title}"`,
        },
      ],
    });

    console.log(`Predict Next Views: ${usage.total} tokens`);

    return data;
  }

  async generateTable(
    context: NcContext,
    params: {
      input: {
        title: string;
        description?: string;
      };
      req?: any;
    },
  ) {
    const { title, description } = params.input;

    return await this.aiSchemaService.generateTable(context, {
      baseId: context.base_id,
      input: title,
      instructions: description,
      req: params.req,
    });
  }

  async generateViews(
    context: NcContext,
    params: {
      input: {
        tableId: string;
      };
      req?: any;
    },
  ) {
    const { tableId } = params.input;

    return await this.aiSchemaService.generateViews(context, {
      baseId: context.base_id,
      tableIds: [tableId],
      req: params.req,
    });
  }
}
