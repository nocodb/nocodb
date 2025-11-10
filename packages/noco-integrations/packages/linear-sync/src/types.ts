interface LinearSyncPayload {
  teamKey: string;
  includeCanceled: boolean;
  includeCompleted: boolean;
}

interface ProcessedIssue {
  id: string;
  title: string;
  identifier: string;
  description: string | null;
  dueDate: string | null;
  priority: number | null;
  stateName: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// GraphQL response types
interface LinearUser {
  id: string;
  name: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface LinearLabel {
  id: string;
  name: string;
}

interface LinearState {
  id: string;
  name: string;
  type: string;
}

interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: LinearUser | null;
}

interface LinearIssue {
  id: string;
  title: string;
  identifier: string;
  description: string | null;
  dueDate: string | null;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  state: LinearState | null;
  assignee: LinearUser | null;
  creator: LinearUser | null;
  labels: { nodes: LinearLabel[] };
  comments: { nodes: LinearComment[] };
}

interface LinearTeam {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members?: { nodes: LinearUser[] };
}

export {
  LinearIssue,
  LinearLabel,
  LinearComment,
  LinearTeam,
  ProcessedIssue,
  LinearSyncPayload,
  LinearUser,
}