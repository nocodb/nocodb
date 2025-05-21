import request from 'supertest';
import Widget from '../../../src/models/Widget';

interface WidgetArgs {
  schema_version: string;
  widget_type: string;
  layout_id: string;
}

const createWidget = async (context, widgetArgs: WidgetArgs) => {
  const response = await request(context.app)
    .post(`/api/v1/layouts/${widgetArgs.layout_id}/widgets`)
    .set('xc-auth', context.token)
    .send(widgetArgs);

  return (await Widget.get(response.body.id)) as Widget;
};

export { createWidget };
