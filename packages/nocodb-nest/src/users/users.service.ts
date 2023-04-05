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
}
