import { Injectable, Logger } from '@nestjs/common';
import { Sandbox } from '@e2b/code-interpreter';
import type { Job } from 'bull';
import type { ExecuteScriptJobData } from '~/interface/Jobs';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { Script } from '~/models';
import { createSandboxCode } from '~/helpers/generateCode';
import { parseSandboxOutputToWorkerMessage } from '~/helpers/sandboxParser';

@Injectable()
export class ScriptExecutionProcessor {
  private readonly logger = new Logger(ScriptExecutionProcessor.name);
  constructor(private readonly jobsLogService: JobsLogService) {}

  async job(job: Job<ExecuteScriptJobData>) {
    const { context, req, scriptId, rowId, tableId, viewId } = job.data;

    if (!process.env.E2B_API_KEY) {
      this.logger.error('E2B_API_KEY is not set');
      return;
    }

    const script = await Script.get(context, scriptId);

    const sendLog = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
    };

    if (!script) {
      sendLog(`Script ${scriptId} not found`);
    }

    const baseSchema = await getBaseSchema(context);
    const sandboxCode = createSandboxCode(
      script.script,
      baseSchema,
      req.user,
      req,
      rowId,
      tableId,
      viewId,
    );
    const sbx = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
    });

    await sbx.commands.run('npm install nc-sdk-v2');

    await sbx.runCode(sandboxCode, {
      language: 'javascript',
      onError: (error) => {
        console.log(error);
      },
      onStdout: (data) => {
        sendLog(parseSandboxOutputToWorkerMessage(data));
      },
      onStderr: (data) => {
        sendLog(parseSandboxOutputToWorkerMessage(data));
      },
    });
  }
}
