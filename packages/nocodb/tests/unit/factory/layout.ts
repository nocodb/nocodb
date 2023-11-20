import request from 'supertest';
import Layout from '../../../src/models/Layout';

interface LayoutArgs {
  title: string;
  base_id: string;
}

const createLayout = async (context, dashboard, layoutArgs: LayoutArgs) => {
  const response = await request(context.app)
    .post(`/api/v1/dashboards/${dashboard.id}/layouts`)
    .set('xc-auth', context.token)
    .send(layoutArgs);

  return (await Layout.get(response.body.id)) as Layout;
};

export { createLayout };
