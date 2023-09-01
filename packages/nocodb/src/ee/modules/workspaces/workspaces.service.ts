import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  ProjectRoles,
  SqlUiFactory,
  WorkspacePlan,
  WorkspaceStatus,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { extractRolesObj } from 'nocodb-sdk';
import type { UserType, WorkspaceType } from 'nocodb-sdk';
import type { AppConfig } from '~/interface/config';
import WorkspaceUser from '~/models/WorkspaceUser';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import Workspace from '~/models/Workspace';
import validateParams from '~/helpers/validateParams';
import { NcError } from '~/helpers/catchError';
import { Project, ProjectUser } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { extractProps } from '~/helpers/extractProps';
import { ProjectsService } from '~/services/projects.service';
import { TablesService } from '~/services/tables.service';

@Injectable()
export class WorkspacesService {
  private logger = new Logger(WorkspacesService.name);

  constructor(
    private appHooksService: AppHooksService,
    private configService: ConfigService<AppConfig>,
    private projectsService: ProjectsService,
    private tablesService: TablesService,
  ) {}

  async list(param: {
    user: {
      id: string;
      roles: string[];
    };
  }) {
    const workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: param.user.id,
    });

    return new PagedResponseImpl<WorkspaceType>(workspaces, {
      count: workspaces.length,
    });
  }

  // TODO: Break the bulk creation logic into a separate api
  async create(param: {
    user: UserType;
    workspaces: WorkspaceType | WorkspaceType[];
  }) {
    const workspacePayloads = Array.isArray(param.workspaces)
      ? param.workspaces
      : [param.workspaces];

    const isBulkMode = Array.isArray(param.workspaces);

    for (const workspacePayload of workspacePayloads) {
      validateParams(['title'], workspacePayload);
    }

    const workspaces = [];

    for (const workspacePayload of workspacePayloads) {
      const workspace = await Workspace.insert({
        ...workspacePayload,
        title: workspacePayload.title.trim(),
        // todo : extend request type
        fk_user_id: param.user.id,
        status: WorkspaceStatus.CREATED,
        plan: WorkspacePlan.FREE,
      });

      // todo: error handling
      // await this.createWorkspaceSubdomain({ titleOrId: workspace.id });

      await WorkspaceUser.insert({
        fk_workspace_id: workspace.id,
        fk_user_id: param.user.id,
        roles: WorkspaceUserRoles.OWNER,
      });

      this.appHooksService.emit(AppEvents.WORKSPACE_CREATE, {
        workspace,
        user: param.user,
      });

      // Create a default project for single workspace creation
      if (!isBulkMode) {
        const project = await this.projectsService.projectCreate({
          project: {
            title: 'Getting Started',
            fk_workspace_id: workspace.id,
            type: 'database',
          } as any,
          user: param.user,
        });

        const sqlUI = SqlUiFactory.create({ client: project.bases[0].type });
        const columns = sqlUI?.getNewTableColumns() as any;

        const table = await this.tablesService.tableCreate({
          projectId: project.id,
          baseId: project.bases[0].id,
          table: {
            title: 'Features',
            table_name: 'Features',
            columns,
          },
          user: param.user,
        });

        (project as any).tables = [table];
        (workspace as any).projects = [project];
      }

      workspaces.push(workspace);
    }
    return isBulkMode ? workspaces : workspaces[0];
  }

  async get(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaceId: string;
  }) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.notFound('Workspace not found');

    return workspace;
  }

  async upgrade(param: {
    user: {
      email: string;
      id: string;
      roles: string[];
    };
    workspaceId: string;
  }) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.notFound('Workspace not found');

    if (workspace.plan !== WorkspacePlan.FREE)
      NcError.notFound('Workspace is already upgraded');

    await this.createWorkspaceSubdomain({
      titleOrId: workspace.id,
      user: param.user?.email ?? param.user?.id,
    });

    await Workspace.updateStatusAndPlan(param.workspaceId, {
      plan: WorkspacePlan.PAID,
      status: WorkspaceStatus.CREATING,
    });

    return workspace;
  }

  async update(param: {
    user: UserType;
    workspaceId: string;
    workspace: WorkspaceType;
  }) {
    const { workspace, user, workspaceId } = param;

    const existingWorkspace = await Workspace.get(param.workspaceId);

    if (!existingWorkspace) NcError.badRequest('Workspace not found');

    if ('order' in workspace) {
      existingWorkspace.order = workspace.order;
      await WorkspaceUser.update(workspaceId, user.id, {
        order: workspace.order,
      });
      delete workspace.order;
    }

    // allow only owner and creator to update anything other that order
    if (
      !(user as any).workspace_roles[WorkspaceUserRoles.OWNER] &&
      !(user as any).workspace_roles[WorkspaceUserRoles.CREATOR]
    )
      return;

    const updateObj = extractProps(workspace, ['title', 'description', 'meta']);

    const updatedWorkspace = await Workspace.update(workspaceId, updateObj);

    this.appHooksService.emit(AppEvents.WORKSPACE_UPDATE, {
      workspace: {
        ...existingWorkspace,
        ...workspace,
      },
      user: param.user,
    });

    return updatedWorkspace;
  }

  async delete(param: { user: UserType; workspaceId: string }) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.badRequest('Workspace not found');

    // todo: avoid removing owner

    // block unauthorized user form deleting

    // todo: unlink any project linked
    await Workspace.delete(param.workspaceId);

    this.appHooksService.emit(AppEvents.WORKSPACE_DELETE, {
      workspace,
      user: param.user,
    });

    return true;
  }

  async moveProject(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaceId: string;
    projectId: string;
  }) {
    const { workspaceId, projectId, user } = param;
    const project = await Project.get(projectId);

    const projectUser = await ProjectUser.get(projectId, user.id);
    const currentWorkspaceUser = await WorkspaceUser.get(
      (project as Project).fk_workspace_id,
      user.id,
    );

    if (
      projectUser?.roles !== ProjectRoles.OWNER &&
      currentWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER
    ) {
      NcError.forbidden('You are not the project owner');
    }

    // verify user is workaggerspace owner

    const destWorkspaceUser = await WorkspaceUser.get(workspaceId, user.id);

    if (destWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER) {
      NcError.forbidden('You are not the workspace owner');
    }

    // update the project workspace id
    await Project.update(param.projectId, {
      fk_workspace_id: workspaceId,
    });

    return true;
  }

  async getProjectList(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaceId: string;
  }) {
    const { workspaceId, user } = param;
    const projects = await Project.listByWorkspaceAndUser(workspaceId, user.id);

    return new PagedResponseImpl<WorkspaceType>(projects, {
      count: projects.length,
    });
  }

  // todo: handle error case
  private async createWorkspaceSubdomain(param: {
    titleOrId: string;
    user: string;
  }) {
    const snsConfig = this.configService.get('workspace.sns', {
      infer: true,
    });

    if (
      !snsConfig.topicArn ||
      !snsConfig.credentials ||
      !snsConfig.credentials.secretAccessKey ||
      !snsConfig.credentials.accessKeyId
    ) {
      this.logger.error('SNS is not configured');
      NcError.notImplemented('Not available');
    }

    // Create publish parameters
    const params = {
      Message: JSON.stringify({
        WS_NAME: param.titleOrId,
        user: param.user,
      }) /* required */,
      TopicArn: snsConfig.topicArn,
    };

    // Create promise and SNS service object
    const publishTextPromise = new AWS.SNS({
      apiVersion: snsConfig.apiVersion,
      region: snsConfig.region,
      credentials: {
        accessKeyId: snsConfig.credentials.accessKeyId,
        secretAccessKey: snsConfig.credentials.secretAccessKey,
      },
    })
      .publish(params)
      .promise();
    try {
      // Handle promise's fulfilled/rejected states
      const data = await publishTextPromise;
      this.logger.log(
        `Message ${params.Message} sent to the topic ${params.TopicArn}`,
      );
      this.logger.log('MessageID is ' + data.MessageId);
    } catch (err) {
      console.error(err, err.stack);
      NcError.internalServerError('Error while upgrading workspace');
    }
  }
}
