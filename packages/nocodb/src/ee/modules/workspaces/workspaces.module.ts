import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { ProjectsService } from '~/services/projects.service';
import { TablesService } from '~/services/tables.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { ColumnsService } from '~/services/columns.service';

@Module({
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    ProjectsService,
    TablesService,
    MetaDiffsService,
    ColumnsService,
  ],
})
export class WorkspacesModule {}
