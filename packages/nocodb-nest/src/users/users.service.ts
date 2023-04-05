import { Injectable } from '@nestjs/common';
import { MetaService } from '../meta/meta.service';

@Injectable()
export class UsersService {

  constructor(private metaService: MetaService) {
  }

  async findOne(email: string) {
    const user = await this.metaService.metaGet(null, null, 'users', { email });


    return user;

  }

  async insert(param: { token_version: string; firstname: any; password: any; salt: any; email_verification_token: any; roles: string; email: string; lastname: any }) {
    return this.metaService.metaInsert2(null, null, 'users', param)
  }
}
