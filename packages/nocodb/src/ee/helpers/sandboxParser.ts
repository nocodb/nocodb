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
function parseSandboxOutputToWorkerMessage(
  data: SandboxOutputData,
): any | null {
  try {
    // Parse the JSON line
    const message = JSON.parse(data.line.trim());
    // Check if it's a structured sandbox message
    if (!message.__nc_sandbox_message__) {
      // Not a structured message, return as log
      return {
        type: 'log', // ScriptActionType.LOG
        payload: {
          args: [data.line],
        },
      };
    }

    const { type, payload } = message;

    switch (type) {
      case 'log':
        return {
          type: 'log', // ScriptActionType.LOG
          payload: {
            args: payload.args || [],
            stepId: payload.stepId,
          },
        };

      case 'error':
        return {
          type: 'error', // ScriptActionType.ERROR
          payload: {
            args: payload.args || [],
            stepId: payload.stepId,
          },
        };

      case 'warn':
        return {
          type: 'warn', // ScriptActionType.WARN
          payload: {
            args: payload.args || [],
            stepId: payload.stepId,
          },
        };

      case 'output':
        return {
          type: 'output', // ScriptActionType.OUTPUT
          payload: {
            message: JSON.stringify({
              action: 'text',
              args: [payload.message, payload.type || 'log'],
            }),
            stepId: payload.stepId,
          },
        };

      case 'table':
        return {
          type: 'output', // ScriptActionType.OUTPUT
          payload: {
            message: JSON.stringify({
              action: 'table',
              args: [payload.data],
            }),
            stepId: payload.stepId,
          },
        };

      case 'markdown':
        return {
          type: 'output', // ScriptActionType.OUTPUT
          payload: {
            message: JSON.stringify({
              action: 'markdown',
              args: [payload.content],
            }),
            stepId: payload.stepId,
          },
        };

      case 'inspect':
        return {
          type: 'output', // ScriptActionType.OUTPUT
          payload: {
            message: JSON.stringify({
              action: 'inspect',
              args: [payload.data],
            }),
            stepId: payload.stepId,
          },
        };

      case 'clear':
        return {
          type: 'output', // ScriptActionType.OUTPUT
          payload: {
            message: JSON.stringify({
              action: 'clear',
              args: [],
            }),
          },
        };

      case 'workflowStepStart':
        return {
          type: 'workflowStepStart', // ScriptActionType.WORKFLOW_STEP_START
          payload: payload,
        };

      case 'workflowStepEnd':
        return {
          type: 'workflowStepEnd', // ScriptActionType.WORKFLOW_STEP_END
          payload: payload,
        };

      case 'recordUpdateStart':
        return {
          type: 'recordUpdateStart', // ScriptActionType.RECORD_UPDATE_START
          payload: payload,
        };

      case 'recordUpdateComplete':
        return {
          type: 'recordUpdateComplete', // ScriptActionType.RECORD_UPDATE_COMPLETE
          payload: payload,
        };

      case 'done':
        return {
          type: 'done', // ScriptActionType.DONE
          payload: {
            message: JSON.stringify({
              action: 'done',
              args: [],
            }),
          },
        };

      default:
        // Unknown message type, return as log
        return {
          type: 'log', // ScriptActionType.LOG
          payload: {
            args: [`Unknown message type: ${type}`, payload],
          },
        };
    }
  } catch (error) {
    // JSON parsing failed, return as log
    return {
      type: 'log', // ScriptActionType.LOG
      payload: {
        args: [data.line],
      },
    };
  }
}

export { parseSandboxOutputToWorkerMessage };
export type { SandboxOutputData };
