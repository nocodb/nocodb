import { Controller } from '@nestjs/common';
import { OrgUsersController as OrgUsersControllerEE } from 'src/ee/controllers/org-users.controller';
import { OrgUsersService } from '~/services/org-users.service';

@Controller()
export class OrgUsersController extends OrgUsersControllerEE {
  constructor(protected readonly orgUsersService: OrgUsersService) {
    super(orgUsersService);
  }
}
