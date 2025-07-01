import { McpService as McpServiceCE } from 'src/mcp/mcp.service';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import { BasesV3Service } from '~/services/v3/bases-v3.service';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import { AuditsService } from '~/services/audits.service';
import { aggregationDescription, whereDescription } from '~/mcp/descriptions';

@Injectable()
export class McpService extends McpServiceCE {
  constructor(
    protected readonly baseV3Service: BasesV3Service,
    protected readonly tablesV3Service: TablesV3Service,
    protected readonly datasV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
    protected readonly auditService: AuditsService,
  ) {
    super(
      baseV3Service,
      tablesV3Service,
      datasV3Service,
      dataTableService,
      auditService,
    );
  }

  protected async registerTools({
    server,
    context,
    user,
    req,
  }: {
    context: NcContext;
    user: UserType & {
      base_roles?: Record<string, boolean>;
      workspace_roles?: Record<string, boolean>;
    };
    server: McpServer;
    req: NcRequest;
  }) {
    await super.registerTools({ server, context, user, req });

    server.registerTool(
      'aggregate',
      {
        title: 'Aggregate Data',
        description:
          'Perform aggregations (sum, count, avg, etc.) on table data with filtering and grouping',
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
        inputSchema: {
          tableId: z.string().describe('Table ID'),
          aggregations: z
            .array(
              z.object({
                field: z.string().describe('Field/column ID to aggregate'),
                type: z
                  .enum([
                    // Numerical aggregations
                    'sum',
                    'min',
                    'max',
                    'avg',
                    'median',
                    'std_dev',
                    'range',
                    // Common aggregations
                    'count',
                    'count_empty',
                    'count_filled',
                    'count_unique',
                    'percent_empty',
                    'percent_filled',
                    'percent_unique',
                    // Boolean aggregations
                    'checked',
                    'unchecked',
                    'percent_checked',
                    'percent_unchecked',
                    // Date aggregations
                    'earliest_date',
                    'latest_date',
                    'date_range',
                    'month_range',
                    // None
                    'none',
                  ])
                  .describe(aggregationDescription),
              }),
            )
            .describe('Array of aggregations to perform'),
          filterGroups: z
            .array(
              z.object({
                alias: z
                  .string()
                  .describe('Alias name for this filter group result'),
                where: z.string().optional().describe(whereDescription),
              }),
            )
            .describe(
              'Array of filter groups - each will produce separate aggregation results',
            ),
          viewId: z
            .string()
            .optional()
            .describe('Optional view ID to use view-specific configurations'),
        },
      },
      async ({ aggregations, tableId, filterGroups, viewId }) => {
        try {
          const bulkFilterList = filterGroups.map((group) => ({
            alias: group.alias,
            where: group.where,
          }));

          const result = await this.dataTableService.bulkAggregate(context, {
            modelId: tableId,
            viewId: viewId,
            query: {
              aggregation: JSON.stringify(aggregations),
            },
            body: JSON.stringify(bulkFilterList),
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          console.log(error);
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );
  }
}
