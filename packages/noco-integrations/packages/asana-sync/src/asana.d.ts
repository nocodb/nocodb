declare module 'asana' {
  export interface Client {
    projects: {
      findById(id: string, options?: any): Promise<any>;
      memberships(id: string, options?: any): Promise<any>;
    };
    tasks: {
      findByProject(projectId: string, options?: any): Promise<any>;
      findById(id: string, options?: any): Promise<any>;
      stories(taskId: string, options?: any): Promise<any>;
    };
  }
}
