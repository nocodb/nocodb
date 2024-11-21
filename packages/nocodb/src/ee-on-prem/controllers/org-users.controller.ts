import {
  Controller,
} from '@nestjs/common';
import { OrgUsersService } from '~/services/org-users.service';
import { OrgUsersController as OrgUsersControllerCE } from 'src/controllers/org-users.controller';

@Controller()
export class OrgUsersController extends  OrgUsersControllerCE {
  constructor(protected readonly orgUsersService: OrgUsersService) {}
}
