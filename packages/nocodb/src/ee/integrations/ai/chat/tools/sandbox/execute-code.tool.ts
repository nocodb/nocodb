import path from 'path';
import { Readable } from 'stream';
import { z } from 'zod';
import { Sandbox } from '@e2b/code-interpreter';
import { Logger } from '@nestjs/common';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { E2B_API_KEY, E2B_TEMPLATE_ID } from '~/integrations/ai/chat/constants';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

const logger = new Logger('ExecuteCodeTool');

export function isE2bEnabled(): boolean {
  return !!(E2B_API_KEY && E2B_TEMPLATE_ID);
}

export const executeCodeTool = defineChatTool({
  name: ChatToolName.EXECUTE_CODE,
  description:
    'Execute JavaScript or Python code in a sandboxed environment to analyze files uploaded by the user. ' +
    'Use this tool when the user asks you to analyze, parse, transform, or extract data from uploaded files ' +
    '(CSV, JSON, PDF, Excel, etc.). The sandbox has access to the uploaded files. ' +
    'Return results as structured data or text.',
  schema: z.object({
    code: z
      .string()
      .describe(
        'The code to execute. Use Python for data analysis (pandas, etc).',
      ),
    language: z
      .enum(['python', 'javascript'])
      .default('python')
      .describe('Programming language. Default: python.'),
  }),
  permission: undefined,
  scope: 'common',
  requiredRole: null,
  isDangerous: false,
  readonly: true,
  visibility: 'data',
  category: 'sandbox',

  async execute(_context, args, req) {
    if (!isE2bEnabled()) {
      return {
        error:
          'Code execution is not available. E2B_API_KEY and E2B_TEMPLATE_ID must be configured.',
      };
    }

    const sessionFiles = (req as any).__sessionFiles;
    if (!sessionFiles?.length) {
      return { error: 'No files available in this session.' };
    }

    let sandbox: InstanceType<typeof Sandbox> | null = null;

    try {
      sandbox = await Sandbox.create(E2B_TEMPLATE_ID, {
        apiKey: E2B_API_KEY,
      });

      // Stream session files into the sandbox via storage adapter (no buffering)
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      for (const file of sessionFiles) {
        const fileName = file.title || 'file';
        try {
          let relativePath: string | undefined;

          if (file.path) {
            relativePath = path.join(
              'nc',
              'uploads',
              file.path.replace(/^download[/\\]/i, ''),
            );
          } else if (file.url) {
            relativePath = getPathFromUrl(file.url).replace(/^\/+/, '');
          }

          if (!relativePath) continue;

          const nodeStream = await storageAdapter.fileReadByStream(
            relativePath,
          );
          if (!nodeStream) continue;

          const webStream = Readable.toWeb(nodeStream) as ReadableStream;
          await sandbox.files.write(`/home/user/${fileName}`, webStream);
        } catch (e) {
          logger.warn(
            `Failed to upload file ${fileName} to sandbox: ${
              (e as Error).message
            }`,
          );
        }
      }

      // Build file listing preamble so the code knows what's available
      const fileList = sessionFiles
        .map((f: any) => f.title || 'file')
        .join(', ');

      const stdout: string[] = [];
      const stderr: string[] = [];

      const execution = await sandbox.runCode(args.code, {
        language: args.language || 'python',
        onStdout: (output) => stdout.push(output.line),
        onStderr: (output) => stderr.push(output.line),
      });

      const result: Record<string, any> = {
        files_available: fileList,
      };

      if (stdout.length) {
        result.stdout = stdout.join('');
      }
      if (stderr.length) {
        result.stderr = stderr.join('');
      }
      if (execution.error) {
        result.error = `${execution.error.name}: ${execution.error.value}`;
        result.traceback = execution.error.traceback;
      }
      if (execution.results?.length) {
        result.results = execution.results.map((r: any) => {
          if (r.text) return r.text;
          if (r.html) return r.html;
          return r;
        });
      }

      return result;
    } catch (e) {
      logger.error(
        `Code execution failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
      return { error: `Execution failed: ${(e as Error).message}` };
    } finally {
      if (sandbox) {
        try {
          await sandbox.kill();
        } catch {}
      }
    }
  },
});
