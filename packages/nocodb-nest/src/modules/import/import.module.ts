import { Module } from '@nestjs/common';
import { AttachmentsService } from '../attachments/attachments.service';
import { ColumnsService } from '../columns/columns.service';
import { FiltersService } from '../filters/filters.service';
import { FormColumnsService } from '../form-columns/form-columns.service';
import { FormsService } from '../forms/forms.service';
import { GalleriesService } from '../galleries/galleries.service';
import { GridsService } from '../grids/grids.service';
import { ProjectUsersService } from '../project-users/project-users.service';
import { ProjectsService } from '../projects/projects.service';
import { SortsService } from '../sorts/sorts.service';
import { TablesService } from '../tables/tables.service';
import { ViewColumnsService } from '../view-columns/view-columns.service';
import { ViewsService } from '../views/views.service';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  controllers: [ImportController],
  providers: [
    ImportService,
    TablesService,
    ViewsService,
    ProjectsService,
    AttachmentsService,
    ColumnsService,
    FiltersService,
    FormColumnsService,
    FormsService,
    GalleriesService,
    ProjectUsersService,
    ViewColumnsService,
    SortsService,
    GridsService,
  ],
})
export class ImportModule {}
