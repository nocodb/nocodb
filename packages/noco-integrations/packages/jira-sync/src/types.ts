export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: 'software' | 'service_desk' | 'business';
  simplified: boolean;
  style?: 'classic' | 'next-gen';

  description?: string;
  url?: string;

  avatarUrls?: AvatarUrls;

  lead?: JiraUser;

  components?: JiraComponent[];
  issueTypes?: JiraIssueType[];
  versions?: JiraVersion[];

  roles?: Record<string, string>; // roleName -> URL
  properties?: Record<string, unknown>;
}

export interface AvatarUrls {
  '16x16'?: string;
  '24x24'?: string;
  '32x32'?: string;
  '48x48'?: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
}

export interface JiraVersion {
  id: string;
  name: string;
  archived: boolean;
  released: boolean;
  releaseDate?: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  active: boolean;
  avatarUrls?: AvatarUrls;
}

export interface JiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  isLast?: boolean;
  issues: JiraIssue[];
  expand?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

export interface JiraIssueFields {
  summary: string;
  description?: JiraDocument | null;

  issuetype: JiraIssueType;
  project: JiraProjectRef;

  status: JiraStatus;
  priority?: JiraPriority;

  assignee?: JiraUser | null;
  reporter?: JiraUser | null;

  created: string;
  updated: string;
  duedate?: string | null;

  labels?: string[];
  components?: JiraComponent[];
  fixVersions?: JiraVersion[];

  parent?: JiraIssueRef;

  // Custom fields (dynamic)
  [customField: `customfield_${number}`]: unknown;
}

export interface JiraProjectRef {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueRef {
  id: string;
  key: string;
  self: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: 'new' | 'indeterminate' | 'done';
    name: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}
export interface JiraDocument {
  type: 'doc';
  version: number;
  content: JiraDocNode[];
}

export interface JiraDocNode {
  type: string;
  content?: JiraDocNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: {
    type: string;
    attrs?: Record<string, unknown>;
  }[];
}
