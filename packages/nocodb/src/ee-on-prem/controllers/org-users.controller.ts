import { Controller } from '@nestjs/common';
import { OrgUsersController as OrgUsersControllerCE } from 'src/controllers/org-users.controller';
import { OrgUsersService } from '~/services/org-users.service';

@Controller()
export class OrgUsersController extends OrgUsersControllerCE {
  constructor(protected readonly orgUsersService: OrgUsersService) {
    super(orgUsersService);
  }
}
