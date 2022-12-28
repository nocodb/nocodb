import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createBook, deleteBook, getBook, listBooks } from '../../factory/book';
import { listPages } from '../../factory/page';
import { createProject } from '../../factory/project';
import init, { NcUnitContext } from '../../init';

function docTests() {
  let context: NcUnitContext;
  let project;
  let book;

  beforeEach(async function () {
    context = await init();
    project = await createProject(context, { title: 'test', type: 'docs' });
    book = await createBook({
      attributes: {
        title: 'test',
      },
      user: context.user,
      project
    });
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

    const parentId = response.body.id

    response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        bookId: book.id,
        attributes: {
          parent_page_id: parentId,
          title: 'nested test',
          content: 'test',
        }
      })
      .expect(200)
    
    const childId = response.body.id
    expect(response.body.parent_page_id).to.equal(parentId)
    expect(response.body.is_parent).to.equal(0)

    response = await request(context.app)
      .get(`/api/v1/docs/page/${parentId}`)
      .query({
        projectId: project.id,
        bookId: book.id,
      })
      .set('xc-auth', context.token)
      .send();
    expect(response.body.is_parent).to.equal(1)

    response = await request(context.app)
      .put(`/api/v1/docs/page/${childId}`)
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

    response = await request(context.app)
    .get(`/api/v1/docs/page/${parentId}`)
    .set('xc-auth', context.token)
    .query({
      projectId: project.id,
      bookId: book.id,
    })
    .send();
    expect(response.body.is_parent).to.equal(0)
  })
}

export default function() {
  describe('NocoDocs', docTests)
}
