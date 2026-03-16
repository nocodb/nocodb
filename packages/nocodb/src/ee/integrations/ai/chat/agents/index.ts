import type { AgentDefinition } from '~/integrations/ai/chat/agents/types';
import { routerAgent } from '~/integrations/ai/chat/agents/router';
import { builderAgent } from '~/integrations/ai/chat/agents/builder';
import { qaAgent } from '~/integrations/ai/chat/agents/qa';
import { recordAgent } from '~/integrations/ai/chat/agents/record';
import { dashboardAgent } from '~/integrations/ai/chat/agents/dashboard';
import { uiAgent } from '~/integrations/ai/chat/agents/ui';
import { fileAnalystAgent } from '~/integrations/ai/chat/agents/file-analyst';

export type {
  AgentDefinition,
  AgentPromptParams,
  RouterPromptParams,
  SpecialistPromptParams,
  SchemaDepth,
  ToolVisibility,
} from '~/integrations/ai/chat/agents/types';

export const AGENTS: Record<string, AgentDefinition> = {
  router: routerAgent,
  builder: builderAgent,
  qa: qaAgent,
  record: recordAgent,
  dashboard: dashboardAgent,
  ui: uiAgent,
  file_analyst: fileAnalystAgent,
};

export const SPECIALIST_NAMES = Object.keys(AGENTS).filter(
  (n) => n !== 'router',
);
