declare module 'jira-client' {
  export default class JiraClient {
    constructor(options: {
      protocol: string;
      host: string;
      username?: string;
      password?: string;
      bearer?: string;
      apiVersion: string;
      strictSSL: boolean;
    });

    searchJira(
      jql: string,
      options?: any,
    ): Promise<{
      total: number;
      issues: any[];
    }>;

    getProject(projectKey: string): Promise<any>;
    getUsersInProject(projectKey: string): Promise<any[]>;
    getComments(issueKey: string): Promise<{
      comments: any[];
    }>;
    getProjectComponents(projectKey: string): Promise<any[]>;
  }
}
