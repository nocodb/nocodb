import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import NocoCache from '../../../../src/lib/cache/NocoCache';
import { createPage, getPage, listPages, updatePage } from '../../factory/page';
import { createProject, updateProject } from '../../factory/project';
import init, { NcUnitContext } from '../../init';
import pageUpdateTest from './docs/pageUpdate.test';

function docTests() {
  let context: NcUnitContext;
  let project;

  pageUpdateTest()

  beforeEach(async function () {
    context = await init();
    project = await createProject(context, { title: 'test', type: 'documentation' });
  });

  it('Create and get page and verify cache', async () => {
    const { body: page1 } = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      attributes: {
        title: 'test1',
        content: 'test1',
      }
    })
    .expect(200)

    expect(page1).to.includes({
      id: page1.id,
      title: 'test1',
      content: 'test1',
      order: 1,
    })

    const { body: page2 } = await request(context.app)
      .get(`/api/v1/docs/page/${page1.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(200)

    expect(page2).to.includes({
      id: page1.id,
      title: 'test1',
      content: 'test1',
      order: 1,
    })

    await NocoCache.destroy();
    await NocoCache.init();

    const response2 = await request(context.app)
      .get(`/api/v1/docs/page/${page1.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
        fields: ['id', 'title']
      })
      .expect(200)

    expect(response2.body).to.have.property('id');
    expect(response2.body).to.have.property('title');
    expect(response2.body).to.not.have.property('content');
    expect(response2.body).to.not.have.property('order');

    const response3 = await request(context.app)
      .get(`/api/v1/docs/page/${page1.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(200)
    
    expect(response3.body).to.have.property('id');
    expect(response3.body).to.have.property('title');
    expect(response3.body).to.have.property('content');
    expect(response3.body).to.have.property('order');
  })  

  it('Create page under a top level nested published page', async () => {
    const parentPage = await createPage({
      project,
      attributes: {
        title: 'parent',
        content: 'parent',
      },
      user: context.user,
    })

    await updatePage({
      project,
      id: parentPage.id!,
      attributes: {
        is_published: true,
      },
      user: context.user,
    })

    const { body: page1 } = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test1',
          parent_page_id: parentPage.id,
        }
      })
      .expect(200)

    expect(page1).to.includes({
      id: page1.id,
      title: 'test1',
      order: 1,
      parent_page_id: parentPage.id,
      is_published: 1,
      nested_published_parent_id: parentPage.id,
    })

  })
  
  it('Create page under a non-top level nested published page', async () => {
    const parentPage = await createPage({
      project,
      attributes: {
        title: 'parent',
        content: 'parent',
      },
      user: context.user,
    })

    const childPage = await createPage({
      project,
      attributes: {
        title: 'child',
        content: 'child',
        parent_page_id: parentPage.id,
      },
      user: context.user,
    })

    await updatePage({
      project,
      id: parentPage.id!,
      attributes: {
        is_published: true,
      },
      user: context.user,
    })

    const { body: page1 } = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test1',
          parent_page_id: childPage.id,
        }
      })
      .expect(200)


    expect(page1).to.includes({
      id: page1.id,
      title: 'test1',
      order: 1,
      parent_page_id: childPage.id,
      is_published: 1,
      nested_published_parent_id: parentPage.id,
    })
  })

  it('Create and list pages', async () => {
    const { body: page1 } = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test1',
          content: 'test1',
        }
      })
      .expect(200)

    expect(page1).to.includes({
      id: page1.id,
      title: 'test1',
      content: 'test1',
      order: 1,
    })

    const { body: page2 } = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      attributes: {
        title: 'test2',
        content: 'test2',
      }
    })
    .expect(200)
    expect(page2).to.includes({
      id: page2.id,
      title: 'test2',
      content: 'test2',
      order: 2,
    })

    const { body: pages } = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(200)
    expect(pages.length).to.equal(2);
  })

  it('Create and delete page', async () => {
    const response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test',
          content: 'test',
        }
      })
      .expect(200)
    expect(response.body).to.have.property('id');

    await request(context.app)
      .delete(`/api/v1/docs/page/${response.body.id}`)
      .query({
        projectId: project.id,
        
      })
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    const pages = await listPages({project,  user: context.user})
    expect(pages.length).to.equal(0)


    await request(context.app)
      .get(`/api/v1/docs/page/${response.body.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(404)
  });

  it('Create and get page', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          title: 'test',
          content: 'test',
        }
      })
      .expect(200)
      expect(response.body).to.have.property('id');

    const id = response.body.id
    response = await request(context.app)
      .get(`/api/v1/docs/page/${response.body.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
        
      })
      .expect(200)

    expect(response.body.id).to.equal(id)
  });

  it('Verify nested pages', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          title: 'test',
          content: 'test',
        }
      })
      .expect(200)
    expect(response.body).to.have.property('id');

    const id = response.body.id
    response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          parent_page_id: id,
          title: 'child test 1',
          content: 'test',
        }
      })
      .expect(200)
    expect(response.body.parent_page_id).to.equal(id)

    response = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      
      attributes: {
        parent_page_id: id,
        title: 'child test 2',
        content: 'test',
      }
    })
    .expect(200)
    expect(response.body.parent_page_id).to.equal(id)

    response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .set('xc-auth', context.token)
      .query({ projectId: project.id })
      .expect(200)


    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal('test')
    expect(response.body[0].is_parent).to.equal(1)
    expect(response.body[0].children).to.be.an('array')
    
    expect(response.body[0].children.length).to.equal(2)
    expect(response.body[0].children[0].title).to.equal('child test 1')
    expect(response.body[0].children[1].title).to.equal('child test 2')
  })

  it('Public page list and get api', async () => {
    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test1',
      },
      user: context.user,
    });
    const childPage1 = await createPage({
      project: project,
      attributes: {
        parent_page_id: page1.id,
        title: 'child test 1',
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test2',
      },
      user: context.user,
    });

    await updatePage({
      id: page1.id!,
      project: project,
      
      attributes: {
        is_published: true,
      },
      user: context.user,
    });

    const response = await request(context.app)
      .get(`/api/v1/public/docs/pages`)
      .query({
        projectId: project.id,
        parent_page_id: page1.id,
      })
      .expect(200)

    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal(page1.title)
    expect(response.body[0].children.length).to.equal(1)

    const response2 = await request(context.app)
      .get(`/api/v1/public/docs/page/${page1.id}`)
      .query({
        projectId: project.id,
      })
      .expect(200)
    expect(response2.body.page.title).to.equal(page1.title)
  })

  it('Public project page list and get api', async () => {
    const publicProject = await createProject(
      context,
      {
        title: 'test',
        meta: {
          isPublic: true,
        },
        type: 'documentation'
      },
    );

    const page1 = await createPage({
      project: publicProject,
      
      attributes: {
        title: 'test1',
      },
      user: context.user,
    });
    const childPage1 = await createPage({
      project: publicProject,
      attributes: {
        parent_page_id: page1.id,
        title: 'child test 1',
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: publicProject,
      
      attributes: {
        title: 'test2',
      },
      user: context.user,
    });

    const response = await request(context.app)
      .get(`/api/v1/public/docs/pages`)
      .query({
        projectId: publicProject.id,
        parent_page_id: page1.id,
      })
      .expect(200)

    expect(response.body.length).to.equal(2)
    expect(response.body[0].title).to.equal(page1.title)
    expect(response.body[0].children.length).to.equal(1)

    const response2 = await request(context.app)
      .get(`/api/v1/public/docs/page/${page1.id}`)
      .query({
        projectId: publicProject.id,
      })
      .expect(200)
    expect(response2.body.page.title).to.equal(page1.title)
  })

  it('Parents', async () => {
    const parentPage = await createPage({
      project: project,
      
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const parentPage2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test2',
        content: 'test2',
        parent_page_id: parentPage.id,
      },
      user: context.user,
    });
    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test3',
        content: 'test3',
        parent_page_id: parentPage2.id,
      },
      user: context.user,
    });

    const response = await request(context.app)
      .get(`/api/v1/docs/page-parents`)
      .query({
        projectId: project.id,
        
        pageId: page1.id,
      })
      .set('xc-auth', context.token)
      .expect(200)
    
    expect(response.body.length).to.equal(2)
    expect(response.body[0].id).to.equal(parentPage2.id)
    expect(response.body[1].id).to.equal(parentPage.id)
  })
}

export default function() {
  describe('NocoDocs', docTests)
}
