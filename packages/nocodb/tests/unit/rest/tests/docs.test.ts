import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createPage, getPage, listPages, updatePage } from '../../factory/page';
import { createProject } from '../../factory/project';
import init, { NcUnitContext } from '../../init';

function docTests() {
  let context: NcUnitContext;
  let project;

  beforeEach(async function () {
    context = await init();
    project = await createProject(context, { title: 'test', type: 'documentation' });
  });


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

    response = await request(context.app)
      .delete(`/api/v1/docs/page/${response.body.id}`)
      .query({
        projectId: project.id,
        
      })
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    const pages = await listPages({project,  user: context.user})
    expect(pages.length).to.equal(0)
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

  it('Update page', async () => {
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
      .put(`/api/v1/docs/page/${id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          title: 'test2',
          content: 'test2',
        }
      })
      .expect(200)
    
    expect(response.body.title).to.equal('test2')
    expect(response.body.last_updated_by_id).to.equal(context.user.id)
  })

  it('Update non existing page', async () => {
    const response = await request(context.app)
      .put(`/api/v1/docs/page/non-existing-id`)
      .set('xc-auth', context.token)
      .send({
        
        projectId: project.id,
        attributes: {
          title: 'test2',
          content: 'test2',
        }
      })
      .expect(400)
    
    expect(response.body.msg).to.equal('Page not found')
  })

  it('Update parent id should update is_parent attribute of that parent', async () => {
    const parentPage = await createPage({
      project,
      
      attributes: {
        title: 'parent',
        content: 'parent',
      },
      user: context.user,
    })

    const child = await createPage({
      project,
      
      attributes: {
        parent_page_id: parentPage.id!,
        title: 'nested test',
        content: 'test',
      },
      user: context.user,
    })
    
    expect(child.parent_page_id).to.equal(parentPage.id)
    expect(child.is_parent).to.equal(0)

    let response = await request(context.app)
      .put(`/api/v1/docs/page/${child.id!}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          title: 'test2',
          content: 'test2',
          parent_page_id: null,
        }
      })
      .expect(200)
    expect(response.body.parent_page_id).to.equal(null)

    const updatedParentWhichIsNotParent = await getPage({
      id: parentPage.id!,
      project,
      
      user: context.user,
    })
    expect(updatedParentWhichIsNotParent.is_parent).to.equal(0)

    response = await request(context.app)
      .put(`/api/v1/docs/page/${child.id!}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          title: 'test2',
          content: 'test2',
          parent_page_id: parentPage.id!,
        }
      })
      .expect(200)
    expect(response.body.parent_page_id).to.equal(parentPage.id!)

    const updatedParentWhichIsParentAgain = await getPage({
      id: parentPage.id!,
      project,
      
      user: context.user,
    })
    expect(updatedParentWhichIsParentAgain.is_parent).to.equal(1)
  })

  it('Slug should be unique if same slug already exists', async () => {
    await createPage({
      project: project,
      attributes: {
        title: 'test',
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      attributes: {
        title: 'test',
      },
      user: context.user,
    });
    expect(page2.slug).to.equal('test-1')
  })

  it('Slug should be unique across sibling pages if if title is updated ', async () => {
    const parent = await createPage({
      project: project,
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page0 = await createPage({
      project: project,
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page0.slug).to.equal('test')

    const page1 = await createPage({
      project: project,
      attributes: {
        title: 'test-1',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page1.slug).to.equal('test-1')

    const page3 = await createPage({
      project: project,
      
      attributes: {
        title: 'test-3',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page3.slug).to.equal('test-3')

    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test-2',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page2.slug).to.equal('test-2')

    await request(context.app)
      .put(`/api/v1/docs/page/${page2.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          title: 'test',
        }
      })
      .expect(200)
    const page2Updated = await getPage({
      id: page2.id!,
      project: project,
      
      user: context.user,
    })
    expect(page2Updated.slug).to.equal('test-4')
  })

  it('Slug should be unique if same slug already exists when its parent page is updated', async () => {
    const parent = await createPage({
      project: project,
      
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
      },
      user: context.user,
    });
    expect(page2.slug).to.equal('test')

    await request(context.app)
      .put(`/api/v1/docs/page/${page1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          parent_page_id: parent.id,
        }
      })
      .expect(200)
    const page1Updated = await getPage({
      id: page1.id!,
      project: project,
      
      user: context.user,
    })
    expect(page1Updated.slug).to.equal('test-1')
  })

  it('Slug should be unique if same slug already exists when its parent page and title is updated', async () => {
    const parent = await createPage({
      project: project,
      
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
      },
      user: context.user,
    });
    expect(page2.slug).to.equal('test')

    await request(context.app)
      .put(`/api/v1/docs/page/${page1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          parent_page_id: parent.id,
          title: 'Updated Test',
        }
      })
      .expect(200)
    const page1Updated = await getPage({
      id: page1.id!,
      project: project,
      
      user: context.user,
    })
    expect(page1Updated.slug).to.equal('updated-test-1')
    expect(page1Updated.title).to.equal('Updated Test')
    expect(page1Updated.parent_page_id).to.equal(parent.id)
    expect(page1Updated.is_parent).to.equal(0)

    const parentUpdated = await getPage({
      id: parent.id!,
      project: project,
      
      user: context.user,
    })
    expect(parentUpdated.is_parent).to.equal(1)
    expect(parentUpdated.slug).to.equal('parent-test')
    expect(parentUpdated.title).to.equal('parent test')
    expect(parentUpdated.parent_page_id).to.equal(null)
  })

  it('is_parent should be correct when child pages are changed', async () => {
    const parent = await createPage({
      project: project,
      
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    await request(context.app)
      .put(`/api/v1/docs/page/${page1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          parent_page_id: null,
          title: 'Updated Test',
        }
      })
      .expect(200)
    const parentPageUpdated = await getPage({
      id: parent.id!,
      project: project,
      
      user: context.user,
    })

    expect(parentPageUpdated.is_parent).to.equal(1)
  })

  it('Page publish should change its flag and update published_content', async () => {
    const page = await createPage({
      project: project,
      
      attributes: {
        title: 'test',
      },
      user: context.user,
    });

    await request(context.app)
      .put(`/api/v1/docs/page/${page.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    const pageUpdated = await getPage({
      id: page.id!,
      project: project,
      
      user: context.user,
    })

    expect(pageUpdated.is_published).to.equal(1)
    expect(pageUpdated.published_content).to.equal(page.content)
  })

  it('Public page list and get api', async () => {
    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test1',
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
        
      })
      .expect(200)
    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal(page1.title)

    const response2 = await request(context.app)
      .get(`/api/v1/public/docs/page/${page1.id}`)
      .query({
        projectId: project.id,
        
      })
      .expect(200)
    expect(response2.body.title).to.equal(page1.title)

    const response3 = await request(context.app)
      .get(`/api/v1/public/docs/page/${page2.id}`)
      .query({
        projectId: project.id,
        
      })
      .expect(400)
  })

  it('Drafts', async () => {
    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const parentPublishedPage = await createPage({
      project: project,
      
      attributes: {
        title: 'parent test',
        is_published: true,
      },
      user: context.user,
    });
    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test2',
        content: 'test2',
        published_content: 'test2',
        is_published: true,
        parent_page_id: parentPublishedPage.id,
      },
      user: context.user,
    });
    const page3 = await createPage({
      project: project,
      
      attributes: {
        title: 'test3',
        content: 'test3',
        published_content: 'old test3',
        is_published: true,
        parent_page_id: parentPublishedPage.id,
      },
      user: context.user,
    });

    const response = await request(context.app)
      .get(`/api/v1/docs/page-drafts`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
        
      })
      .expect(200)
    expect(response.body.length).to.equal(2)
  })

  it('Batch publish', async () => {
    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test2',
        content: 'test2',
      },
      user: context.user,
    });

    await request(context.app)
      .post(`/api/v1/docs/page/batch-publish`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        pageIds: [page1.id, page2.id],
      })
      .expect(200)
    
    const pages = await listPages({
      project: project,
      
      user: context.user,
    })
    expect(pages.length).to.equal(2)
    expect(pages[0].is_published).to.equal(1)
    expect(pages[1].is_published).to.equal(1)
  })

  it('Pagination', async () => {
    // Create 10 pages
    for (let i = 0; i < 10; i++) {      
      await createPage({
        project: project,
        
        attributes: {
          title: 'test' + i,
        },
        user: context.user,
      });
    }

    const response = await request(context.app)
      .get(`/api/v1/docs/pages/paginate`)
      .query({
        projectId: project.id,
        
        pageNumber: 1,
        perPage: 5,
      })
      .set('xc-auth', context.token)
      .expect(200)
    
    expect(response.body.pages.length).to.equal(5)
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

  it('Sort by title', async () => {
    const pageC = await createPage({
      project: project,
      
      user: context.user,
      attributes: {
        title: 'testC',
      },
    })
    const pageA = await createPage({
      project: project,
      
      user: context.user,
      attributes: {
        title: 'testA',
      }
    })
    const pageB = await createPage({
      project: project,
      
      user: context.user,
      attributes: {
        title: 'testB',
      }
    })

    const response = await request(context.app)
      .get(`/api/v1/docs/pages/paginate`)
      .query({
        projectId: project.id,
        
        pageNumber: 1,
        perPage: 5,
        sortField: 'title',
        sortOrder: 'asc',
      })
      .set('xc-auth', context.token)
      .expect(200)
    
    expect(response.body.pages.length).to.equal(3)
    expect(response.body.pages[0].id).to.equal(pageA.id)
    expect(response.body.pages[1].id).to.equal(pageB.id)
    expect(response.body.pages[2].id).to.equal(pageC.id)
  })

  it('Search pages', async () => {
    const page1 = await createPage({
      project: project,
      
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const page2 = await createPage({
      project: project,
      
      attributes: {
        title: 'test2',
        content: 'test2',
      },
      user: context.user,
    });

    const response = await request(context.app)
      .get(`/api/v1/docs/pages/search`)
      .query({
        projectId: project.id,
        
        query: 'test1',
      })
      .set('xc-auth', context.token)
      .expect(200)
    
    console.log(response.body)

    expect(response.body.pages.length).to.equal(1)
    expect(response.body.pages[0].id).to.equal(page1.id)
  })
}

export default function() {
  describe('NocoDocs', docTests)
}
