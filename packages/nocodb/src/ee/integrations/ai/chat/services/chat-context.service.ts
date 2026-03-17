import { Injectable } from '@nestjs/common';
import { ChatMessageRole } from 'nocodb-sdk';
import type { ChatMessageType } from 'nocodb-sdk';
import type { ModelMessage } from 'ai';
import type { NcContext } from '~/interface/config';
import { AGENTS, type SchemaDepth } from '~/integrations/ai/chat/agents';
import { estimateTokens } from '~/integrations/ai/chat/helpers/tokenlens';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';
import { getBaseSchema } from '~/helpers/scriptHelper';

interface SchemaField {
  id?: string;
  name: string;
  type: string;
  primary_value?: boolean;
  options?: {
    choices?: { title: string }[];
    relation_type?: string;
    related_table_id?: string;
  };
}

interface SchemaTable {
  id: string;
  name: string;
  fields: SchemaField[];
}

@Injectable()
export class ChatContextService {
  async buildSchemaForAgent(
    agentName: string,
    context: NcContext,
    _baseId: string,
    activeTableId: string | undefined,
    _req: any,
  ): Promise<string> {
    const depth: SchemaDepth = AGENTS[agentName]?.schemaDepth || 'full';

    // Support agent and others with 'none' depth don't need schema context
    if (depth === 'none') return '';

    const baseSchema = await getBaseSchema(context);

    // Filter out tables the user cannot see based on TABLE_VISIBILITY permissions
    let tables = baseSchema.tables;
    if (context.user) {
      const visibleTables: typeof tables = [];
      for (const table of tables) {
        const hasAccess = await hasTableVisibilityAccess(
          context,
          table.id,
          context.user,
        );
        if (hasAccess) {
          visibleTables.push(table);
        }
      }
      tables = visibleTables;
    }

    const lines: string[] = [];

    for (const table of tables) {
      const isActive = activeTableId && table.id === activeTableId;
      const showFullFields =
        depth === 'full' || (depth === 'focused' && isActive);

      if (showFullFields) {
        const label = isActive
          ? `Table "${table.name}" [id=${table.id}] (active)`
          : `Table "${table.name}" [id=${table.id}]`;
        lines.push(`${label}: ${this.formatFields(table.fields)}`);
      } else {
        lines.push(this.formatTableSummary(table));
      }
    }

    const rels = this.formatRelationships(tables);
    if (rels) lines.push(rels);

    return lines.join('\n');
  }

  buildHistoryMessages(params: {
    messages: ChatMessageType[];
  }): ModelMessage[] {
    return this.toModelMessages(params.messages);
  }

  async estimateMessageTokens(
    msg: ChatMessageType,
    modelId?: string,
  ): Promise<number> {
    if (msg.parts?.length) {
      let sum = 0;
      for (const p of msg.parts) {
        const text = p.type === 'text' ? p.text : JSON.stringify(p);
        sum += await estimateTokens(text, modelId);
      }
      return sum;
    }
    return estimateTokens(msg.content || '', modelId);
  }

  private formatFields(fields: SchemaField[]): string {
    return fields
      .map((f) => {
        let desc = f.id ? `${f.name} (${f.type}, id=${f.id})` : `${f.name} (${f.type})`;
        if (f.options?.choices?.length) {
          desc += ` [${f.options.choices.map((c) => c.title).join(', ')}]`;
        }
        return desc;
      })
      .join(', ');
  }

  private formatTableSummary(table: SchemaTable): string {
    const primary = table.fields.find((f) => f.primary_value);
    const label = primary ? ` (primary: ${primary.name})` : '';
    return `Table "${table.name}" [id=${table.id}]${label} — ${table.fields.length} fields`;
  }

  private formatRelationships(tables: SchemaTable[]): string | null {
    const tableNames = new Map(tables.map((t) => [t.id, t.name]));
    const rels: string[] = [];

    for (const table of tables) {
      for (const field of table.fields) {
        if (field.options?.relation_type && field.options?.related_table_id) {
          const related = tableNames.get(field.options.related_table_id) || '?';
          rels.push(
            `${table.name}.${field.name} ${field.options.relation_type} ${related}`,
          );
        }
      }
    }

    return rels.length ? 'Relationships: ' + rels.join('; ') : null;
  }

  private toModelMessages(messages: ChatMessageType[]): ModelMessage[] {
    const result: ModelMessage[] = [];

    for (const msg of messages) {
      if (msg.role === ChatMessageRole.USER) {
        let content = msg.content || '';

        // Append file attachment info so the AI knows what files the user uploaded
        if (msg.files?.length) {
          const fileList = msg.files
            .map((f: any) => f.title || 'file')
            .join(', ');
          const fileNote = `\n\n[Attached files: ${fileList}]`;
          content = content ? content + fileNote : fileNote.trim();
        }

        if (content) {
          result.push({ role: 'user', content });
        }
        continue;
      }

      if (msg.role !== ChatMessageRole.ASSISTANT) continue;

      if (!msg.parts?.length) {
        result.push({ role: 'assistant', content: msg.content || '' });
        continue;
      }

      const toolBlocks = msg.parts.filter(
        (p): p is Extract<typeof p, { type: 'tool_use' }> =>
          p.type === 'tool_use',
      );

      const completedToolIds = new Set(
        toolBlocks.filter((p) => p.output !== undefined).map((p) => p.id),
      );

      const contentParts: Array<
        | { type: 'text'; text: string }
        | {
            type: 'tool-call';
            toolCallId: string;
            toolName: string;
            input: unknown;
          }
      > = [];

      for (const part of msg.parts) {
        if (part.type === 'text' && part.text) {
          contentParts.push({ type: 'text', text: part.text });
        } else if (part.type === 'tool_use' && completedToolIds.has(part.id)) {
          contentParts.push({
            type: 'tool-call' as const,
            toolCallId: part.id,
            toolName: part.name,
            input: part.input || {},
          });
        }
      }

      if (contentParts.length) {
        result.push({ role: 'assistant', content: contentParts });
      }

      for (const p of toolBlocks) {
        if (p.output !== undefined) {
          result.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result' as const,
                toolCallId: p.id,
                toolName: p.name,
                output: {
                  type: 'text' as const,
                  value:
                    typeof p.output === 'string'
                      ? p.output
                      : JSON.stringify(p.output),
                },
              },
            ],
          });
        }
      }
    }

    return result;
  }
}
