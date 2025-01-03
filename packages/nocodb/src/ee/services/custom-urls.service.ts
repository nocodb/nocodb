import { Injectable } from '@nestjs/common';
import { CustomUrl } from '~/models';

@Injectable()
export class CustomUrlsService {
  constructor() {}

  async get(id: string) {
    return await CustomUrl.get({ id });
  }

  async checkAvailability(
    params: Partial<Pick<CustomUrl, 'id' | 'custom_path'>>,
  ) {
    return await CustomUrl.checkAvailability(params);
  }

  async getOriginalPath(custom_path: string) {
    const customUrl = await CustomUrl.getCustomUrlByCustomPath(custom_path);

    if (!customUrl) {
      return;
    }

    return customUrl.original_path;
  }
}
