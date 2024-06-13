import 'mocha';
import request from 'supertest';
import { beforeEach } from 'mocha';
import { Exception } from 'handlebars';
import { expect } from 'chai';
import { Base } from '../../../../src/models';
import { createTable } from '../../factory/table';
import init from '../../init';
import { createProject, createSharedBase } from '../../factory/base';
import { RootScopes } from '../../../../src/utils/globals';

// Test case list
// 1. Get base info
// 2. UI ACL
// 3. Create base
// 4. Create base with existing title
// 5. Update base
// 6. Update base with existing title
// 7. Create base shared base
// 8. Created base shared base should have only editor or viewer role
// 9. Updated base shared base should have only editor or viewer role
// 10. Updated base shared base
// 11. Get base shared base
// 12. Delete base shared base
// 13. Meta diff sync
// 14. Meta diff sync
// 15. Meta diff sync
// 16. Get all bases meta

function baseTest() {
  let context;
  let base;

  beforeEach(async function () {
    console.time('#### baseTest');
    context = await init();
    base = await createProject(context);
    console.timeEnd('#### baseTest');
  });

  it('Get base info', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${base.id}/info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);
  });

  // todo: Test by creating models under base and check if the UCL is working
  it('UI ACL', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${base.id}/visibility-rules`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);
  });
  // todo: Test creating visibility set

  it('List projects', async () => {
    let response;
    if (process.env.EE !== 'true') {
      response = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-auth', context.token)
        .send({})
        .expect(200);
    } else {
      response = await request(context.app)
        .get(`/api/v1/workspaces/${context.fk_workspace_id}/bases`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);
    }

    if (response.body.list.length !== 1) new Error('Should list only 1 base');
    if (!response.body.pageInfo) new Error('Should have pagination info');
  });

  it('Create base', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({
        title: 'Title1',
        ...(process.env.EE === 'true' && {
          fk_workspace_id: context.fk_workspace_id,
        }),
      })
      .expect(200);

    const newProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      response.body.id,
    );
    if (!newProject) return new Error('Base not created');
  });

  it('Create projects with existing title', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({
        title: base.title,
        ...(process.env.EE === 'true' && {
          fk_workspace_id: context.fk_workspace_id,
        }),
      })
      .expect(200);
  });

  // todo: fix passport user role popluation bug
  // it('Delete base', async async () => {
  //   const toBeDeletedProject = await createProject(app, token, {
  //     title: 'deletedTitle',
  //   });
  //   await request(app)
  //     .delete('/api/v1/db/meta/projects/${toBeDeletedProject.id}')
  //     .set('xc-auth', token)
  //     .send({
  //       title: 'Title1',
  //     })
  //     .expect(200, async (err) => {
  //       // console.log(res);
  //

  //       const deletedProject = await Base.getByTitleOrId(
  //         toBeDeletedProject.id
  //       );
  //       if (deletedProject) return new Error('Base not delete');

  //       new Error();
  //     });
  // });

  it('Read base', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${base.id}`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);

    if (response.body.id !== base.id) return new Error('Got the wrong base');
  });

  it('Update projects', async () => {
    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${base.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'NewTitle',
      })
      .expect(200);

    const newProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );
    if (newProject.title !== 'NewTitle') {
      return new Error('Base not updated');
    }
  });

  it('Update projects with existing title', async function () {
    if (process.env.EE !== 'true') {
      const newProject = await createProject(context, {
        title: 'NewTitle1',
      });

      // Allow base rename to be replaced with same title
      await request(context.app)
        .patch(`/api/v1/db/meta/projects/${base.id}`)
        .set('xc-auth', context.token)
        .send({
          title: newProject.title,
        })
        .expect(400);
    }
  });

  it('Create base shared base', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${base.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'viewer',
        password: 'password123',
      })
      .expect(200);

    const updatedProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );

    if (
      !updatedProject.uuid ||
      updatedProject.roles !== 'viewer' ||
      updatedProject.password !== 'password123'
    ) {
      return new Error('Shared base not configured properly');
    }
  });

  it('Created base shared base should have only editor or viewer role', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${base.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'password123',
      })
      .expect(200);

    const updatedProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );

    if (updatedProject.roles === 'commenter') {
      return new Error('Shared base not configured properly');
    }
  });

  it('Updated base shared base should have only editor or viewer role', async () => {
    await createSharedBase(context.app, context.token, base);

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${base.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'password123',
      })
      .expect(200);

    const updatedProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );

    if (updatedProject.roles === 'commenter') {
      throw new Exception('Shared base not updated properly');
    }
  });

  it('Updated base shared base', async () => {
    await createSharedBase(context.app, context.token, base);

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${base.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'editor',
        password: 'password123',
      })
      .expect(200);
    const updatedProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );

    if (updatedProject.roles !== 'editor') {
      throw new Exception('Shared base not updated properly');
    }
  });

  it('Get base shared base', async () => {
    await createSharedBase(context.app, context.token, base);

    await request(context.app)
      .get(`/api/v1/db/meta/projects/${base.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);

    const updatedProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );
    if (!updatedProject.uuid) {
      throw new Exception('Shared base not created');
    }
  });

  it('Delete base shared base', async () => {
    await createSharedBase(context.app, context.token, base);

    await request(context.app)
      .delete(`/api/v1/db/meta/projects/${base.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
    const updatedProject = await Base.getByTitleOrId(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      base.id,
    );
    if (updatedProject.uuid) {
      throw new Exception('Shared base not deleted');
    }
  });

  // todo: Do compare api test

  it('Meta diff sync', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${base.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
  });

  it('Meta diff sync', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${base.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
  });

  // todo: improve test. Check whether the all the actions are present in the response and correct as well
  it('Meta diff sync', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${base.id}/audits`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
  });

  it('Get all bases meta', async () => {
    if (process.env.EE === 'true') {
      return;
    }

    await createTable(context, base, {
      table_name: 'table1',
      title: 'table1',
    });
    await createTable(context, base, {
      table_name: 'table2',
      title: 'table2',
    });
    await createTable(context, base, {
      table_name: 'table3',
      title: 'table3',
    });

    await request(context.app)
      .get(`/api/v1/aggregated-meta-info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
      .then((res) => {
        const createdProject =
          res.body.bases[process.env.EE === 'true' ? 2 : 1];

        expect(res.body).to.have.all.keys(
          'userCount',
          'sharedBaseCount',
          'baseCount',
          'bases',
        );
        // As there will be a default base created for a workspace (EE tests create one extra)
        expect(res.body)
          .to.have.property('baseCount')
          .to.eq(process.env.EE === 'true' ? 3 : 2);
        expect(res.body).to.have.property('bases').to.be.an('array');

        expect(createdProject.tableCount.table).to.be.eq(3);
        expect(res.body)
          .to.have.nested.property('bases[1].tableCount.table')
          .to.be.a('number');
        expect(res.body)
          .to.have.nested.property('bases[1].tableCount.view')
          .to.be.a('number');
        expect(res.body)
          .to.have.nested.property('bases[1].viewCount')
          .to.be.an('object')
          .have.keys(
            'formCount',
            'gridCount',
            'galleryCount',
            'kanbanCount',
            'total',
            'sharedFormCount',
            'sharedGridCount',
            'sharedGalleryCount',
            'sharedKanbanCount',
            'sharedTotal',
            'sharedLockedCount',
          );
        expect(createdProject).have.keys(
          'external',
          'webhookCount',
          'filterCount',
          'sortCount',
          'userCount',
          'rowCount',
          'tableCount',
          'viewCount',
        );
        expect(res.body)
          .to.have.nested.property('bases[1].rowCount')
          .to.be.an('array');
        expect(res.body)
          .to.have.nested.property('bases[1].external')
          .to.be.an('boolean');
      });
  });
}

export default function () {
  describe('Base', baseTest);
}
