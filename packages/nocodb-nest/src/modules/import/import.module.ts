import { Module } from '@nestjs/common';
import { AttachmentsService } from '../../services/attachments.service';
import { ColumnsService } from '../../services/columns.service';
import { BulkDataAliasService } from '../../services/bulk-data-alias.service';
import { FiltersService } from '../../services/filters.service';
import { FormColumnsService } from '../../services/form-columns.service';
import { FormsService } from '../../services/forms.service';
import { GalleriesService } from '../../services/galleries.service';
import { GlobalModule } from '../global/global.module';
import { GridsService } from '../../services/grids.service';
import { ProjectUsersService } from '../project-users/project-users.service';
import { ProjectsService } from '../../services/projects.service';
import { SortsService } from '../../services/sorts.service';
import { TablesService } from '../../services/tables.service';
import { ViewColumnsService } from '../../services/view-columns.service';
import { ViewsService } from '../../services/views.service';
import { ImportService } from '../../services/import.service';
import { ImportController } from '../../controllers/import.controller';

@Module({
  imports: [GlobalModule],
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
    BulkDataAliasService,
  ],
})
export class ImportModule {}
