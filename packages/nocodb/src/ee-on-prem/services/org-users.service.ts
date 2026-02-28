import { Injectable } from '@nestjs/common';
import { OrgUsersService as OrgUsersServiceCE } from 'src/services/org-users.service';

@Injectable()
export class OrgUsersService extends OrgUsersServiceCE {}
