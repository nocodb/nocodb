import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createPage, getPage, listPages, updatePage } from '../../../factory/page';
import { createProject, updateProject } from '../../../factory/project';
import { createWorkspace } from '../../../factory/workspace';
import init, { NcUnitContext } from '../../../init';

function docTests() {
  let context: NcUnitContext;
  let workspace;
  let project;
  let parentPage1, parentPage2, childPage1, childPage2, childPage3, childPage4;
  let childPage1Child, childPage2Child, childPage3Child, childPage4Child;

  beforeEach(async function () {
    context = await init();
    workspace = await createWorkspace(context);
    project = await createProject(context, { title: 'test', type: 'documentation', fk_workspace_id: workspace.id } as any);

    const _createPage = async (attributes) => createPage({ project, attributes, user: context.user });
    
    parentPage1 = await _createPage({ title: 'parentPage1' });
    parentPage2 = await _createPage({ title: 'parentPage2' });

    childPage1 = await _createPage({ title: 'childPage1', parent_page_id: parentPage1.id });
    childPage2 = await _createPage({ title: 'childPage2', parent_page_id: parentPage1.id });
    childPage3 = await _createPage({ title: 'childPage3', parent_page_id: parentPage2.id });
    childPage4 = await _createPage({ title: 'childPage4', parent_page_id: parentPage2.id });

    childPage1Child = await _createPage({ title: 'childPage1Child', parent_page_id: childPage1.id });
    childPage2Child = await _createPage({ title: 'childPage2Child', parent_page_id: childPage2.id });
    childPage3Child = await _createPage({ title: 'childPage3Child', parent_page_id: childPage3.id });
    childPage4Child = await _createPage({ title: 'childPage4Child', parent_page_id: childPage4.id });
  });

  it('Page publish should change its flag and update published_content and update its children', async () => {
    const childChildPage = await createPage({
      project: project,
      attributes: {
        title: 'test',
        parent_page_id: childPage1.id,
      },
      user: context.user,
    });

    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: false,
        }
      })
      .expect(200)

    const pageUpdated = await getPage({
      id: parentPage1.id!,
      project: project,
      
      user: context.user,
    })

    expect(pageUpdated.is_published).to.equal(0)
    expect(pageUpdated.nested_published_parent_id).to.equal(null)

    const childPageUpdated = await getPage({
      id: childPage1.id!,
      project: project,
    
      user: context.user,
    })

    expect(childPageUpdated.is_published).to.equal(0)
    expect(childPageUpdated.parent_page_id).to.equal(parentPage1.id)
    expect(childPageUpdated.nested_published_parent_id).to.equal(null)

    const childChildPageUpdated = await getPage({
      id: childChildPage.id!,
      project: project,

      user: context.user,
    })

    expect(childChildPageUpdated.is_published).to.equal(0)
    expect(childChildPageUpdated.parent_page_id).to.equal(childPage1.id)
    expect(childChildPageUpdated.nested_published_parent_id).to.equal(null)
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

    response = await request(context.app)
      .get(`/api/v1/docs/page/${response.body.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
        fields: ['id', 'title', 'content']
      })
      .expect(200)
    
    expect(response.body.title).to.equal('test')
    expect(response.body.content).to.equal('test')

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

    response = await request(context.app)
      .get(`/api/v1/docs/page/${id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(200)
    
    expect(response.body.title).to.equal('test2')
    expect(response.body.last_updated_by_id).to.equal(context.user.id)
    expect(response.body.content).to.equal('test2')
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

    expect(page1Updated.slug).to.equal('test-2')
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
    expect(page1Updated.slug).to.equal('updated-test')
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

  it('Page un publish should change its flag and update its children', async () => {
    const page = await createPage({
      project: project,
      attributes: {
        title: 'test',
        is_published: true,
      },
      user: context.user,
    });

    const childPage = await createPage({
      project: project,
      attributes: {
        title: 'test',
        parent_page_id: page.id,
      },
      user: context.user,
    });

    const childChildPage = await createPage({
      project: project,
      attributes: {
        title: 'test',
        parent_page_id: childPage.id,
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

    const childPageUpdated = await getPage({
      id: childPage.id!,
      project: project,
    
      user: context.user,
    })

    expect(childPageUpdated.is_published).to.equal(1)
    expect(childPageUpdated.published_content).to.equal(childPage.content)
    expect(childPageUpdated.parent_page_id).to.equal(page.id)
    expect(childPageUpdated.nested_published_parent_id).to.equal(page.id)

    const childChildPageUpdated = await getPage({
      id: childChildPage.id!,
      project: project,

      user: context.user,
    })

    expect(childChildPageUpdated.is_published).to.equal(1)
    expect(childChildPageUpdated.published_content).to.equal(childChildPage.content)
    expect(childChildPageUpdated.parent_page_id).to.equal(childPage.id)
    expect(childChildPageUpdated.nested_published_parent_id).to.equal(page.id)
  })

  it('Unpublished Page moved to a published parent page, should publish it and its children', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    await request(context.app)
      .put(`/api/v1/docs/page/${childPage3.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: parentPage1.id,
        }
      })
      .expect(200)

    const pageUpdated = await getPage({
      id: childPage3.id!,
      project: project,
      
      user: context.user,
    })

    expect(pageUpdated.is_published).to.equal(1)
    expect(pageUpdated.parent_page_id).to.equal(parentPage1.id)
    expect(pageUpdated.nested_published_parent_id).to.equal(parentPage1.id)

    const newChildPage3Child = await getPage({
      id: childPage3Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage3Child.is_published).to.equal(1)
    expect(newChildPage3Child.parent_page_id).to.equal(childPage3.id)
    expect(newChildPage3Child.nested_published_parent_id).to.equal(parentPage1.id)
  })

  it('Top Nested Published Page moved to an unpublished parent page', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: parentPage2.id,
        }
      })
      .expect(200)

    const newParentPage1 = await getPage({
      id: parentPage1.id!,
      project: project,
      user: context.user,
    })

    expect(newParentPage1.is_published).to.equal(0)
    expect(newParentPage1.parent_page_id).to.equal(parentPage2.id)
    expect(newParentPage1.nested_published_parent_id).to.equal(null)

    const newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(0)
    expect(newChildPage1.parent_page_id).to.equal(parentPage1.id)
    expect(newChildPage1.nested_published_parent_id).to.equal(null)

    const newChildPage1Child = await getPage({
      id: childPage1Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1Child.is_published).to.equal(0)
    expect(newChildPage1Child.parent_page_id).to.equal(childPage1.id)
    expect(newChildPage1Child.nested_published_parent_id).to.equal(null)
  })

  it('Published nested non-top level Page moved to a un published parent page', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    let newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(1)
    expect(newChildPage1.parent_page_id).to.equal(parentPage1.id)
    expect(newChildPage1.nested_published_parent_id).to.equal(parentPage1.id)

    await request(context.app)
      .put(`/api/v1/docs/page/${childPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: parentPage2.id,
        }
      })
      .expect(200)

     newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(0)
    expect(newChildPage1.parent_page_id).to.equal(parentPage2.id)
    expect(newChildPage1.nested_published_parent_id).to.equal(null)

    const newChildPage1Child = await getPage({
      id: childPage1Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1Child.is_published).to.equal(0)
    expect(newChildPage1Child.parent_page_id).to.equal(childPage1.id)
    expect(newChildPage1Child.nested_published_parent_id).to.equal(null)
  })

  it('Nested Published Page moved to a different published parent page', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

      await request(context.app)
      .put(`/api/v1/docs/page/${parentPage2.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    await request(context.app)
      .put(`/api/v1/docs/page/${childPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: parentPage2.id,
        }
      })
      .expect(200)

    const newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(1)
    expect(newChildPage1.parent_page_id).to.equal(parentPage2.id)
    expect(newChildPage1.nested_published_parent_id).to.equal(parentPage2.id)

    const newChildPage1Child = await getPage({
      id: childPage1Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1Child.is_published).to.equal(1)
    expect(newChildPage1Child.parent_page_id).to.equal(childPage1.id)
    expect(newChildPage1Child.nested_published_parent_id).to.equal(parentPage2.id)
  })

  it('Top nested Published Page moved to a different published parent page', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

      await request(context.app)
      .put(`/api/v1/docs/page/${parentPage2.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: parentPage2.id,
        }
      })
      .expect(200)

    const newParentPage1 = await getPage({
      id: parentPage1.id!,
      project: project,
      user: context.user,
    })

    expect(newParentPage1.is_published).to.equal(1)
    expect(newParentPage1.parent_page_id).to.equal(parentPage2.id)
    expect(newParentPage1.nested_published_parent_id).to.equal(parentPage2.id)

    const newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(1)
    expect(newChildPage1.parent_page_id).to.equal(parentPage1.id)
    expect(newChildPage1.nested_published_parent_id).to.equal(parentPage2.id)

    const newChildPage1Child = await getPage({
      id: childPage1Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1Child.is_published).to.equal(1)
    expect(newChildPage1Child.parent_page_id).to.equal(childPage1.id)
    expect(newChildPage1Child.nested_published_parent_id).to.equal(parentPage2.id)
  })

  it('Top Nested Published Page parent moved to top level page', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${childPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          is_published: true,
        }
      })

    await request(context.app)
      .put(`/api/v1/docs/page/${childPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: null,
        }
      })

    const newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(1)
    expect(newChildPage1.parent_page_id).to.equal(null)
    expect(newChildPage1.nested_published_parent_id).to.equal(newChildPage1.id)

    const newChildPage1Child = await getPage({
      id: childPage1Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1Child.is_published).to.equal(1)
    expect(newChildPage1Child.parent_page_id).to.equal(childPage1.id)
    expect(newChildPage1Child.nested_published_parent_id).to.equal(newChildPage1.id)
  })

  it('Non-Top Nested Published Page moved to top level page', async () => {
    await request(context.app)
      .put(`/api/v1/docs/page/${parentPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          is_published: true,
        }
      })

    await request(context.app)
      .put(`/api/v1/docs/page/${childPage1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: null,
        }
      })

    const newChildPage1 = await getPage({
      id: childPage1.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1.is_published).to.equal(0)
    expect(newChildPage1.parent_page_id).to.equal(null)
    expect(newChildPage1.nested_published_parent_id).to.equal(null)

    const newChildPage1Child = await getPage({
      id: childPage1Child.id!,
      project: project,
      user: context.user,
    })

    expect(newChildPage1Child.is_published).to.equal(0)
    expect(newChildPage1Child.parent_page_id).to.equal(childPage1.id)
    expect(newChildPage1Child.nested_published_parent_id).to.equal(null)
  })
}

export default function() {
  describe('NocoDocsPageUpdate', docTests)
}
