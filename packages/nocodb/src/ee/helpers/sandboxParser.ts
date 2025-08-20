interface SandboxOutputData {
  error: boolean;
  line: string;
  timestamp: number;
}

/**
 * Convert E2B sandbox output to handleWorkerMessage format
 * @param data - The sandbox output data from onStdout/onStderr/onError
 * @returns Worker message format that handleWorkerMessage expects
 */

interface SandboxMessage {
  type: string;
  payload: any;
  stepId?: string;
  timestamp?: number;
}

function parseSandboxOutputToWorkerMessage(
  data: SandboxOutputData,
): SandboxMessage | null {
  try {
    const message = JSON.parse(data.line.trim()) as SandboxMessage;

    // Validate it has required fields
    if (!message.type || message.payload === undefined) {
      return {
        type: 'log',
        payload: {
          args: [data.line],
        },
      };
    }

    return message;
  } catch (error) {
    // JSON parsing failed, return as log
    return {
      type: 'log',
      payload: {
        args: [data.line],
      },
    };
  }
}
export { parseSandboxOutputToWorkerMessage };
export type { SandboxOutputData };
