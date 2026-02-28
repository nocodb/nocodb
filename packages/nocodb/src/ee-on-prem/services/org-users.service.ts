import { Injectable } from '@nestjs/common';
import { OrgUsersService as OrgUsersServiceEE } from 'src/ee/services/org-users.service';

@Injectable()
export class OrgUsersService extends OrgUsersServiceEE {}
