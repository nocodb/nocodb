import { BaseWidgetHandler } from '~/db/widgets/base-widget.handler';

export async function getWidgetHandler(..._params: any) {
  return new BaseWidgetHandler();
}
