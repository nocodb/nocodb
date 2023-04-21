import { Injectable } from '@nestjs/common';

@Injectable()
export class AppHooksService {

  // eslint-disable-next-line @typescript-eslint/ban-types
  private listeners = new Map<string, Function[]>();




}
