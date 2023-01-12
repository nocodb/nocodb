import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createBook, deleteBook, getBook, listBooks } from '../../factory/book';
import { createPage, getPage, listPages, updatePage } from '../../factory/page';
import { createProject } from '../../factory/project';
import init, { NcUnitContext } from '../../init';

function docTests() {
  let context: NcUnitContext;
  let project;
  let book;

  beforeEach(async function () {
    context = await init();
    project = await createProject(context, { title: 'test', type: 'documentation' });
    book = (await listBooks({ project: project, user: context.user }))[0];
  });

  it('Create book', async () => {
    const response = await request(context.app)
      .post(`/api/v1/docs/book`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test',
          description: 'test',
        }
      })
      .expect(200)
    console.log(response.body)
    expect(response.body).to.have.property('id');
  })

  it('List book', async () => {
    const response1 = await request(context.app)
      .get(`/api/v1/docs/books`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(200)
    expect(response1.body.length).to.equal(1)
  })

  it('Update book', async () => {
    await deleteBook({id: book.id!, project, user: context.user});
    const book1 = await createBook({
      attributes: {
        title: 'test1',
        description: 'test1',
      },
      user: context.user,
      project
    });
    const book2 = await createBook({
      attributes: {
        title: 'test2',
        description: 'test2',
      },
      user: context.user,
      project
    });
    expect(book1.id).to.not.equal(book2.id);
    expect(book1.title).to.not.equal(book2.title);
    expect(book1.description).to.not.equal(book2.description);
    expect(Number(book1.order)).equal(1);
    expect(Number(book2.order)).equal(2);

    const response = await request(context.app)
      .put(`/api/v1/docs/book/${book1.id}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'updated test1',
          description: 'updated test1',
          order: 2,
        } 
      })
      .expect(200)
    expect(response.body.id).to.equal(book1.id!);
    expect(response.body.title).equal('updated test1');
    expect(response.body.description).equal('updated test1');
    expect(response.body.order).equal(2);

    const updatedBook1 = await getBook({id: book1.id!, project, user: context.user});
    const updatedBook2 = await getBook({id: book2.id!, project, user: context.user});
    

    expect(updatedBook1.id).to.equal(book1.id);
    expect(updatedBook1.order).to.equal(2);
    expect(updatedBook2.id).to.equal(book2.id);
    expect(updatedBook2.order).to.equal(1);
  })

  it('List books with different projects', async () => {
    await deleteBook({id: book.id!, project, user: context.user});

    const newProject = await createProject(context, { title: 'test2', type: 'docs' });
    await createBook({
      attributes: {
        title: 'test1',
        description: 'test1',
      },
      user: context.user,
      project
    });
    await createBook({
      attributes: {
        title: 'test2',
        description: 'test2',
      },
      user: context.user,
      project: newProject
    });

    expect((await listBooks({project, user: context.user})).length).to.equal(1);
  })

  it('Delete book', async () => {
    await request(context.app)
      .delete(`/api/v1/docs/book/${book.id}`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
      })
      .expect(200)

    const books = await listBooks({project, user: context.user});
    expect(books.length).to.equal(0);
  })

  it('Create and list pages', async () => {
    const book1 = await createBook({
      attributes: {
        title: 'test1',
      },
      user: context.user,
      project
    });
    const book2 = await createBook({
      attributes: {
        title: 'test2',
      },
      user: context.user,
      project
    });

    const { body: page1 } = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        bookId: book1.id,
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
      book_id: book1.id,
      order: 1,
    })

    const { body: page2 } = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      bookId: book1.id,
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
      book_id: book1.id,
      order: 2,
    })

    const { body: page3 } = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      bookId: book2.id,
      attributes: {
        title: 'test3',
        content: 'test3',
      }
    })
    .expect(200)
    expect(page3).to.includes({
      id: page3.id,
      title: 'test3',
      content: 'test3',
      book_id: book2.id,
      order: 1,
    })

    const { body: pages } = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .set('xc-auth', context.token)
      .query({
        projectId: project.id,
        bookId: book1.id,
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
        bookId: book.id,
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
        bookId: book.id,
      })
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    const pages = await listPages({project, book, user: context.user})
    expect(pages.length).to.equal(0)
  });

  it('Create and get page', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        bookId: book.id,
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
        bookId: book.id,
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
        bookId: book.id,
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
        bookId: book.id,
        attributes: {
          parent_page_id: id,
          title: 'nested test',
          content: 'test',
        }
      })
      .expect(200)

    expect(response.body.parent_page_id).to.equal(id)

    // get nested page
    response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .query({ parent_page_id: id, projectId: project.id, bookId: book.id })
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal('nested test')
    expect(response.body[0].is_parent).to.equal(0)
    
    // get top level pages
    response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .set('xc-auth', context.token)
      .query({ projectId: project.id, bookId: book.id })
      .expect(200)

    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal('test')
    expect(response.body[0].is_parent).to.equal(1)
  })

  it('Update page', async () => {
    let response = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      bookId: book.id,
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
        bookId: book.id,
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
        bookId: book.id,
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
      book,
      attributes: {
        title: 'parent',
        content: 'parent',
      },
      user: context.user,
    })

    const child = await createPage({
      project,
      book,
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
        bookId: book.id,
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
      book,
      user: context.user,
    })
    expect(updatedParentWhichIsNotParent.is_parent).to.equal(0)

    response = await request(context.app)
      .put(`/api/v1/docs/page/${child.id!}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        bookId: book.id,
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
      book,
      user: context.user,
    })
    expect(updatedParentWhichIsParentAgain.is_parent).to.equal(1)
  })

  it('Slug should be unique if same slug already exists', async () => {
    await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test',
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      book: book,
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
      book: book,
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page0 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page0.slug).to.equal('test')

    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test-1',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page1.slug).to.equal('test-1')

    const page3 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test-3',
        parent_page_id: parent.id,
      },
      user: context.user,
    });
    expect(page3.slug).to.equal('test-3')

    const page2 = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
        attributes: {
          title: 'test',
        }
      })
      .expect(200)
    const page2Updated = await getPage({
      id: page2.id!,
      project: project,
      book: book,
      user: context.user,
    })
    expect(page2Updated.slug).to.equal('test-4')
  })

  it('Slug should be unique if same slug already exists when its parent page is updated', async () => {
    const parent = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
        attributes: {
          parent_page_id: parent.id,
        }
      })
      .expect(200)
    const page1Updated = await getPage({
      id: page1.id!,
      project: project,
      book: book,
      user: context.user,
    })
    expect(page1Updated.slug).to.equal('test-1')
  })

  it('Slug should be unique if same slug already exists when its parent page and title is updated', async () => {
    const parent = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
        attributes: {
          parent_page_id: parent.id,
          title: 'Updated Test',
        }
      })
      .expect(200)
    const page1Updated = await getPage({
      id: page1.id!,
      project: project,
      book: book,
      user: context.user,
    })
    expect(page1Updated.slug).to.equal('updated-test-1')
    expect(page1Updated.title).to.equal('Updated Test')
    expect(page1Updated.parent_page_id).to.equal(parent.id)
    expect(page1Updated.is_parent).to.equal(0)

    const parentUpdated = await getPage({
      id: parent.id!,
      project: project,
      book: book,
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
      book: book,
      attributes: {
        title: 'parent test',
      },
      user: context.user,
    });

    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test',
        parent_page_id: parent.id,
      },
      user: context.user,
    });

    const page2 = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
        attributes: {
          parent_page_id: null,
          title: 'Updated Test',
        }
      })
      .expect(200)
    const parentPageUpdated = await getPage({
      id: parent.id!,
      project: project,
      book: book,
      user: context.user,
    })

    expect(parentPageUpdated.is_parent).to.equal(1)
  })

  it('Page publish should change its flag and update published_content', async () => {
    const page = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
        attributes: {
          is_published: true,
        }
      })
      .expect(200)

    const pageUpdated = await getPage({
      id: page.id!,
      project: project,
      book: book,
      user: context.user,
    })

    expect(pageUpdated.is_published).to.equal(1)
    expect(pageUpdated.published_content).to.equal(page.content)
  })

  it('Public book api', async () => {
    const response = await request(context.app)
      .get(`/api/v1/public/docs/books/latest`)
      .query({
        projectId: project.id,
      })
      .expect(200)
    expect(response.body.title).to.equal(book.title)

    const book2 = await createBook({
      project: project,
      attributes: {
        title: 'test2',
      },
      user: context.user,
    });

    const response2 = await request(context.app)
      .get(`/api/v1/public/docs/books/latest`)
      .query({
        projectId: project.id,
      })
      .expect(200)
    
    expect(response2.body.title).to.equal(book2.title)
  })

  it('Public page list and get api', async () => {
    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test1',
      },
      user: context.user,
    });
    const page2 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test2',
      },
      user: context.user,
    });

    await updatePage({
      id: page1.id!,
      project: project,
      book: book,
      attributes: {
        is_published: true,
      },
      user: context.user,
    });

    const response = await request(context.app)
      .get(`/api/v1/public/docs/pages`)
      .query({
        projectId: project.id,
        bookId: book.id,
      })
      .expect(200)
    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal(page1.title)

    const response2 = await request(context.app)
      .get(`/api/v1/public/docs/page/${page1.id}`)
      .query({
        projectId: project.id,
        bookId: book.id,
      })
      .expect(200)
    expect(response2.body.title).to.equal(page1.title)

    const response3 = await request(context.app)
      .get(`/api/v1/public/docs/page/${page2.id}`)
      .query({
        projectId: project.id,
        bookId: book.id,
      })
      .expect(400)
  })

  it('Drafts', async () => {
    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const parentPublishedPage = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'parent test',
        is_published: true,
      },
      user: context.user,
    });
    const page2 = await createPage({
      project: project,
      book: book,
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
      book: book,
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
        bookId: book.id,
      })
      .expect(200)
    expect(response.body.length).to.equal(2)
  })

  it('Batch publish', async () => {
    const page1 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const page2 = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
        pageIds: [page1.id, page2.id],
      })
      .expect(200)
    
    const pages = await listPages({
      project: project,
      book: book,
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
        book: book,
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
        bookId: book.id,
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
      book: book,
      attributes: {
        title: 'test1',
        content: 'test1',
      },
      user: context.user,
    });
    const parentPage2 = await createPage({
      project: project,
      book: book,
      attributes: {
        title: 'test2',
        content: 'test2',
        parent_page_id: parentPage.id,
      },
      user: context.user,
    });
    const page1 = await createPage({
      project: project,
      book: book,
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
        bookId: book.id,
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
