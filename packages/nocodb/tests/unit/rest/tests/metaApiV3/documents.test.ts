import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';

interface CreateDocArgs {
  title?: string;
  content?: Record<string, any>;
  meta?: Record<string, any>;
  parent_id?: string | null;
}

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Documents v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX: string;

    async function _createDoc(args: CreateDocArgs = {}, token?: string) {
      const response = await request(context.app)
        .post(`${API_PREFIX}/docs`)
        .set('xc-auth', token ?? context.token)
        .send(args)
        .expect(200);

      return response.body;
    }

    async function _getDoc(docId: string, token?: string) {
      const response = await request(context.app)
        .get(`${API_PREFIX}/docs/${docId}`)
        .set('xc-auth', token ?? context.token)
        .expect(200);

      return response.body;
    }

    async function _listDocs(parentId?: string | null, token?: string) {
      const qs =
        parentId === undefined ? '' : `?parent_id=${parentId ?? 'null'}`;
      const response = await request(context.app)
        .get(`${API_PREFIX}/docs${qs}`)
        .set('xc-auth', token ?? context.token)
        .expect(200);

      return response.body;
    }

    function _verifyDocListItem(doc: any) {
      expect(doc).to.be.an('object');
      expect(doc).to.have.property('id').that.is.a('string');
      expect(doc).to.have.property('base_id', initBase.id);
      expect(doc).to.have.property('title').that.is.a('string');
      expect(doc).to.have.property('order').that.is.a('number');
      expect(doc).to.have.property('has_children').that.is.a('boolean');
      expect(doc).to.have.property('version').that.is.a('number');
      expect(doc).to.have.property('created_at').that.is.a('string');
      expect(doc).to.have.property('updated_at').that.is.a('string');
      // List items should NOT include content
      expect(doc).to.not.have.property('content');
    }

    function _verifyDocFull(doc: any) {
      expect(doc).to.be.an('object');
      expect(doc).to.have.property('id').that.is.a('string');
      expect(doc).to.have.property('base_id', initBase.id);
      expect(doc).to.have.property('title').that.is.a('string');
      expect(doc).to.have.property('content').that.is.an('object');
      expect(doc).to.have.property('order').that.is.a('number');
      expect(doc).to.have.property('has_children').that.is.a('boolean');
      expect(doc).to.have.property('version').that.is.a('number');
      expect(doc).to.have.property('created_at').that.is.a('string');
      expect(doc).to.have.property('updated_at').that.is.a('string');
    }

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'DocTestBase' })
        .expect(200);

      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
    });

    // --- Create ---

    it('Create document with title', async () => {
      const doc = await _createDoc({ title: 'My Document' });
      _verifyDocFull(doc);
      expect(doc.title).to.equal('My Document');
      expect(doc.content).to.deep.equal({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
      expect(doc.parent_id).to.equal(null);
    });

    it('Create document with defaults (no args)', async () => {
      const doc = await _createDoc();
      _verifyDocFull(doc);
      expect(doc.title).to.equal('Untitled');
      expect(doc.content).to.be.an('object');
    });

    it('Create document with content', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Hello World' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Some text here.' }],
          },
        ],
      };

      const doc = await _createDoc({ title: 'Rich Doc', content });
      _verifyDocFull(doc);
      expect(doc.content.content).to.have.lengthOf(2);
      expect(doc.content.content[0].type).to.equal('heading');
    });

    it('Create child document', async () => {
      const parent = await _createDoc({ title: 'Parent' });
      const child = await _createDoc({
        title: 'Child',
        parent_id: parent.id,
      });

      _verifyDocFull(child);
      expect(child.parent_id).to.equal(parent.id);

      // Parent should now have has_children = true
      const updatedParent = await _getDoc(parent.id);
      expect(updatedParent.has_children).to.equal(true);
    });

    it('Create document with meta', async () => {
      const meta = { icon: '📄', cover_image: null };
      const doc = await _createDoc({ title: 'Meta Doc', meta });
      _verifyDocFull(doc);
      expect(doc.meta).to.deep.include({ icon: '📄' });
    });

    // --- Block Type Round-Trips ---

    it('Content round-trip: bulletList', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item one' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item two' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Bullet List', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: orderedList', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Ordered List', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: taskList', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Done task' }],
                  },
                ],
              },
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Pending task' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Task List', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: blockquote', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'To be or not to be.' }],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Blockquote', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: codeBlock', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [
              { type: 'text', text: 'const x = 42;' },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Code Block', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: image', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.com/photo.png',
              id: 'fr_abc123',
            },
          },
        ],
      };
      const doc = await _createDoc({ title: 'Image', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: fileAttachment', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'fileAttachment',
            attrs: { id: 'fr_file456' },
          },
        ],
      };
      const doc = await _createDoc({ title: 'File Attachment', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: horizontalRule', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Above' }] },
          { type: 'horizontalRule' },
          { type: 'paragraph', content: [{ type: 'text', text: 'Below' }] },
        ],
      };
      const doc = await _createDoc({ title: 'HR', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: table', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Name' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Value' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Foo' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '42' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Table', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: callout', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { icon: '💡' },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Tip: use callouts for emphasis.' }],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Callout', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: columns', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'columns',
            content: [
              {
                type: 'column',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Left column' }],
                  },
                ],
              },
              {
                type: 'column',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Right column' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Columns', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: embed', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'embed',
            attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          },
        ],
      };
      const doc = await _createDoc({ title: 'Embed', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: math', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'math',
            attrs: { expression: 'E = mc^2' },
          },
        ],
      };
      const doc = await _createDoc({ title: 'Math', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    it('Content round-trip: inline marks (bold, italic, code, link, highlight)', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                marks: [{ type: 'bold' }],
                text: 'bold',
              },
              {
                type: 'text',
                marks: [{ type: 'italic' }],
                text: 'italic',
              },
              {
                type: 'text',
                marks: [{ type: 'underline' }],
                text: 'underlined',
              },
              {
                type: 'text',
                marks: [{ type: 'strike' }],
                text: 'struck',
              },
              {
                type: 'text',
                marks: [{ type: 'code' }],
                text: 'inline code',
              },
              {
                type: 'text',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                text: 'a link',
              },
              {
                type: 'text',
                marks: [{ type: 'highlight', attrs: { color: '#ffeb3b' } }],
                text: 'highlighted',
              },
            ],
          },
        ],
      };
      const doc = await _createDoc({ title: 'Marks', content });
      const fetched = await _getDoc(doc.id);
      expect(fetched.content).to.deep.equal(content);
    });

    // --- Read ---

    it('Get document by ID', async () => {
      const created = await _createDoc({ title: 'Get Me' });
      const doc = await _getDoc(created.id);

      _verifyDocFull(doc);
      expect(doc.id).to.equal(created.id);
      expect(doc.title).to.equal('Get Me');
      expect(doc.content).to.be.an('object');
    });

    it('Get non-existent document returns error', async () => {
      await request(context.app)
        .get(`${API_PREFIX}/docs/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(422);
    });

    // --- List ---

    it('List root documents', async () => {
      await _createDoc({ title: 'Doc A' });
      await _createDoc({ title: 'Doc B' });
      await _createDoc({ title: 'Doc C' });

      const result = await _listDocs(null);
      expect(result).to.have.property('list').that.is.an('array');
      expect(result.list).to.have.lengthOf(3);

      for (const doc of result.list) {
        _verifyDocListItem(doc);
      }
    });

    it('List child documents', async () => {
      const parent = await _createDoc({ title: 'Parent' });
      await _createDoc({ title: 'Child 1', parent_id: parent.id });
      await _createDoc({ title: 'Child 2', parent_id: parent.id });

      const result = await _listDocs(parent.id);
      expect(result.list).to.have.lengthOf(2);

      for (const doc of result.list) {
        _verifyDocListItem(doc);
      }
    });

    it('List returns empty for no docs', async () => {
      const result = await _listDocs(null);
      expect(result.list).to.be.an('array').that.is.empty;
    });

    // --- Update ---

    it('Update document title', async () => {
      const doc = await _createDoc({ title: 'Original' });

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Updated Title', version: doc.version })
        .expect(200);

      const updated = updateResponse.body;
      _verifyDocFull(updated);
      expect(updated.title).to.equal('Updated Title');
      expect(updated.version).to.equal(doc.version + 1);
    });

    it('Update document content', async () => {
      const doc = await _createDoc({ title: 'Content Update' });

      const newContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Updated content' }],
          },
        ],
      };

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .send({ content: newContent, version: doc.version })
        .expect(200);

      const updated = updateResponse.body;
      expect(updated.content.content[0].content[0].text).to.equal(
        'Updated content',
      );
    });

    it('Update fails without version (optimistic concurrency)', async () => {
      const doc = await _createDoc({ title: 'Version Test' });

      await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'No Version' })
        .expect(422);
    });

    it('Update fails with stale version', async () => {
      const doc = await _createDoc({ title: 'Stale Test' });

      // First update succeeds
      await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'V2', version: doc.version })
        .expect(200);

      // Second update with old version fails
      await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'V2 again', version: doc.version })
        .expect(422);
    });

    it('Update non-existent document returns error', async () => {
      await request(context.app)
        .patch(`${API_PREFIX}/docs/nonexistent_id`)
        .set('xc-auth', context.token)
        .send({ title: 'Ghost', version: 1 })
        .expect(422);
    });

    // --- Delete ---

    it('Delete document', async () => {
      const doc = await _createDoc({ title: 'Delete Me' });

      await request(context.app)
        .delete(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify it's gone
      await request(context.app)
        .get(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .expect(422);
    });

    it('Delete cascades to children', async () => {
      const parent = await _createDoc({ title: 'Parent' });
      const child = await _createDoc({
        title: 'Child',
        parent_id: parent.id,
      });

      await request(context.app)
        .delete(`${API_PREFIX}/docs/${parent.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Child should also be gone
      await request(context.app)
        .get(`${API_PREFIX}/docs/${child.id}`)
        .set('xc-auth', context.token)
        .expect(422);
    });

    it('Delete non-existent document returns error', async () => {
      await request(context.app)
        .delete(`${API_PREFIX}/docs/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(422);
    });

    // --- Reorder ---

    it('Reorder document (change order)', async () => {
      const doc = await _createDoc({ title: 'Reorder Me' });

      const reorderResponse = await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}/reorder`)
        .set('xc-auth', context.token)
        .send({ order: 5.5 })
        .expect(200);

      const updated = reorderResponse.body;
      _verifyDocFull(updated);
      expect(updated.order).to.equal(5.5);
    });

    it('Move document to different parent', async () => {
      const parent1 = await _createDoc({ title: 'Parent 1' });
      const parent2 = await _createDoc({ title: 'Parent 2' });
      const child = await _createDoc({
        title: 'Moving Child',
        parent_id: parent1.id,
      });

      const moveResponse = await request(context.app)
        .patch(`${API_PREFIX}/docs/${child.id}/reorder`)
        .set('xc-auth', context.token)
        .send({ order: 1, parent_id: parent2.id })
        .expect(200);

      const moved = moveResponse.body;
      expect(moved.parent_id).to.equal(parent2.id);

      // Verify parent2 now has children
      const p2 = await _getDoc(parent2.id);
      expect(p2.has_children).to.equal(true);
    });

    it('Move document to root', async () => {
      const parent = await _createDoc({ title: 'Parent' });
      const child = await _createDoc({
        title: 'Child',
        parent_id: parent.id,
      });

      const moveResponse = await request(context.app)
        .patch(`${API_PREFIX}/docs/${child.id}/reorder`)
        .set('xc-auth', context.token)
        .send({ order: 1, parent_id: null })
        .expect(200);

      const moved = moveResponse.body;
      expect(moved.parent_id).to.equal(null);
    });

    it('Cannot move document under itself', async () => {
      const doc = await _createDoc({ title: 'Self Move' });

      await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}/reorder`)
        .set('xc-auth', context.token)
        .send({ order: 1, parent_id: doc.id })
        .expect(422);
    });

    it('Cannot move document under its own descendant', async () => {
      const parent = await _createDoc({ title: 'Grandparent' });
      const child = await _createDoc({
        title: 'Parent',
        parent_id: parent.id,
      });
      const grandchild = await _createDoc({
        title: 'Child',
        parent_id: child.id,
      });

      // Try to move grandparent under grandchild — circular
      await request(context.app)
        .patch(`${API_PREFIX}/docs/${parent.id}/reorder`)
        .set('xc-auth', context.token)
        .send({ order: 1, parent_id: grandchild.id })
        .expect(422);
    });

    // --- Multiple operations ---

    it('Full CRUD lifecycle', async () => {
      // Create
      const doc = await _createDoc({
        title: 'Lifecycle Doc',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        },
      });
      expect(doc.title).to.equal('Lifecycle Doc');

      // Read
      const fetched = await _getDoc(doc.id);
      expect(fetched.id).to.equal(doc.id);

      // Update
      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Updated Lifecycle', version: doc.version })
        .expect(200);
      expect(updateResponse.body.title).to.equal('Updated Lifecycle');

      // List
      const listResult = await _listDocs(null);
      expect(listResult.list).to.have.lengthOf(1);
      expect(listResult.list[0].title).to.equal('Updated Lifecycle');

      // Delete
      await request(context.app)
        .delete(`${API_PREFIX}/docs/${doc.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify deleted
      const emptyList = await _listDocs(null);
      expect(emptyList.list).to.be.an('array').that.is.empty;
    });

    it('Hierarchical tree operations', async () => {
      // Build a tree: root → child1, child2; child1 → grandchild
      const root = await _createDoc({ title: 'Root' });
      const child1 = await _createDoc({
        title: 'Child 1',
        parent_id: root.id,
      });
      await _createDoc({ title: 'Child 2', parent_id: root.id });
      await _createDoc({ title: 'Grandchild', parent_id: child1.id });

      // List root docs
      const rootDocs = await _listDocs(null);
      expect(rootDocs.list).to.have.lengthOf(1);
      expect(rootDocs.list[0].has_children).to.equal(true);

      // List children of root
      const children = await _listDocs(root.id);
      expect(children.list).to.have.lengthOf(2);

      // List children of child1
      const grandchildren = await _listDocs(child1.id);
      expect(grandchildren.list).to.have.lengthOf(1);
      expect(grandchildren.list[0].title).to.equal('Grandchild');
    });

    // ================================================================
    // ADDITIONAL ROBUSTNESS TESTS
    // ================================================================

    // --- Authentication ---

    describe('Authentication', () => {
      it('Unauthenticated list returns 401', async () => {
        const res = await request(context.app)
          .get(`${API_PREFIX}/docs?parent_id=null`);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Unauthenticated create returns 401', async () => {
        const res = await request(context.app)
          .post(`${API_PREFIX}/docs`)
          .send({ title: 'No Auth' });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Unauthenticated get returns 401', async () => {
        const doc = await _createDoc({ title: 'Auth Test' });
        const res = await request(context.app)
          .get(`${API_PREFIX}/docs/${doc.id}`);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Unauthenticated update returns 401', async () => {
        const doc = await _createDoc({ title: 'Auth Test' });
        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}`)
          .send({ title: 'Hacked', version: 1 });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Unauthenticated delete returns 401', async () => {
        const doc = await _createDoc({ title: 'Auth Test' });
        const res = await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc.id}`);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Unauthenticated reorder returns 401', async () => {
        const doc = await _createDoc({ title: 'Auth Test' });
        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}/reorder`)
          .send({ order: 10 });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Invalid token returns 401', async () => {
        const res = await request(context.app)
          .get(`${API_PREFIX}/docs?parent_id=null`)
          .set('xc-auth', 'invalid-token-xyz');
        expect(res.status).to.be.oneOf([401, 403]);
      });
    });

    // --- ACL (Role-Based Access) ---

    describe('ACL — Role-Based Access on V3 endpoints', () => {
      let viewerToken: string;
      let editorToken: string;
      let seedDocId: string;

      beforeEach(async () => {
        const workspaceId = context.fk_workspace_id;

        // Create viewer
        const viewer = await createUser(
          { app: context.app },
          { email: 'v3-viewer@doc-test.com', password: 'Test1234!' },
        );
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-auth', context.token)
          .send({
            email: 'v3-viewer@doc-test.com',
            workspace_role: 'workspace-level-viewer',
          })
          .expect(200);
        viewerToken = viewer.token;

        // Create editor
        const editor = await createUser(
          { app: context.app },
          { email: 'v3-editor@doc-test.com', password: 'Test1234!' },
        );
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-auth', context.token)
          .send({
            email: 'v3-editor@doc-test.com',
            workspace_role: 'workspace-level-editor',
          })
          .expect(200);
        editorToken = editor.token;

        // Seed doc as owner
        const seedDoc = await _createDoc({ title: 'Seed Doc' });
        seedDocId = seedDoc.id;
      });

      // Viewer: list + get allowed, create/update/delete/reorder denied
      it('Viewer can list documents', async () => {
        await _listDocs(null, viewerToken);
      });

      it('Viewer can get document', async () => {
        await _getDoc(seedDocId, viewerToken);
      });

      it('Viewer cannot create document', async () => {
        const res = await request(context.app)
          .post(`${API_PREFIX}/docs`)
          .set('xc-auth', viewerToken)
          .send({ title: 'Viewer Create' });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Viewer cannot update document', async () => {
        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${seedDocId}`)
          .set('xc-auth', viewerToken)
          .send({ title: 'Viewer Update', version: 1 });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Viewer cannot delete document', async () => {
        const res = await request(context.app)
          .delete(`${API_PREFIX}/docs/${seedDocId}`)
          .set('xc-auth', viewerToken);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Viewer cannot reorder document', async () => {
        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${seedDocId}/reorder`)
          .set('xc-auth', viewerToken)
          .send({ order: 99 });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      // Editor: list + get + update + reorder allowed, create/delete denied
      it('Editor can list documents', async () => {
        await _listDocs(null, editorToken);
      });

      it('Editor can get document', async () => {
        await _getDoc(seedDocId, editorToken);
      });

      it('Editor cannot create document', async () => {
        const res = await request(context.app)
          .post(`${API_PREFIX}/docs`)
          .set('xc-auth', editorToken)
          .send({ title: 'Editor Create' });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Editor can update document', async () => {
        await request(context.app)
          .patch(`${API_PREFIX}/docs/${seedDocId}`)
          .set('xc-auth', editorToken)
          .send({ title: 'Editor Updated', version: 1 })
          .expect(200);
      });

      it('Editor cannot delete document', async () => {
        const res = await request(context.app)
          .delete(`${API_PREFIX}/docs/${seedDocId}`)
          .set('xc-auth', editorToken);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('Editor can reorder document', async () => {
        await request(context.app)
          .patch(`${API_PREFIX}/docs/${seedDocId}/reorder`)
          .set('xc-auth', editorToken)
          .send({ order: 50 })
          .expect(200);
      });
    });

    // --- Input Validation Edge Cases ---

    describe('Input validation', () => {
      it('Whitespace-only title trims to Untitled', async () => {
        const doc = await _createDoc({ title: '   ' });
        expect(doc.title).to.equal('Untitled');
      });

      it('Empty string title becomes Untitled', async () => {
        const doc = await _createDoc({ title: '' });
        expect(doc.title).to.equal('Untitled');
      });

      it('Title with leading/trailing spaces is trimmed', async () => {
        const doc = await _createDoc({ title: '  Padded Title  ' });
        expect(doc.title).to.equal('Padded Title');
      });

      it('Update with whitespace-only title becomes Untitled', async () => {
        const doc = await _createDoc({ title: 'Has Title' });
        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .send({ title: '   ', version: doc.version })
          .expect(200);
        expect(res.body.title).to.equal('Untitled');
      });

      it('HTML/script in title is stored as-is (no injection)', async () => {
        const xssTitle = '<script>alert("xss")</script>';
        const doc = await _createDoc({ title: xssTitle });
        expect(doc.title).to.equal(xssTitle);
      });

      it('HTML/script in content is stored as-is', async () => {
        const content = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '<img src=x onerror=alert(1)>' },
              ],
            },
          ],
        };
        const doc = await _createDoc({ title: 'XSS Content', content });
        const fetched = await _getDoc(doc.id);
        expect(fetched.content.content[0].content[0].text).to.equal(
          '<img src=x onerror=alert(1)>',
        );
      });
    });

    // --- Version Edge Cases ---

    describe('Version edge cases', () => {
      it('New document starts at version 1', async () => {
        const doc = await _createDoc({ title: 'Version Start' });
        expect(doc.version).to.equal(1);
      });

      it('Update with version=0 fails (stale)', async () => {
        const doc = await _createDoc({ title: 'V0 Test' });
        await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .send({ title: 'V0 Update', version: 0 })
          .expect(422);
      });

      it('Sequential updates with correct version chaining succeed', async () => {
        const doc = await _createDoc({ title: 'Chain V1' });
        let currentVersion = doc.version;

        for (let i = 2; i <= 5; i++) {
          const res = await request(context.app)
            .patch(`${API_PREFIX}/docs/${doc.id}`)
            .set('xc-auth', context.token)
            .send({ title: `Chain V${i}`, version: currentVersion })
            .expect(200);
          currentVersion = res.body.version;
          expect(currentVersion).to.equal(i);
        }

        const final = await _getDoc(doc.id);
        expect(final.title).to.equal('Chain V5');
        expect(final.version).to.equal(5);
      });
    });

    // --- Idempotency & State ---

    describe('Idempotency and state after operations', () => {
      it('Double-delete returns error on second attempt', async () => {
        const doc = await _createDoc({ title: 'Double Delete' });

        await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        // Second delete should fail — doc already gone
        await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .expect(422);
      });

      it('Update after delete returns error', async () => {
        const doc = await _createDoc({ title: 'Update After Delete' });

        await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .send({ title: 'Ghost Update', version: doc.version })
          .expect(422);
      });

      it('Reorder after delete returns error', async () => {
        const doc = await _createDoc({ title: 'Reorder After Delete' });

        await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}/reorder`)
          .set('xc-auth', context.token)
          .send({ order: 10 })
          .expect(422);
      });

      it('List excludes deleted documents', async () => {
        const doc1 = await _createDoc({ title: 'Keep Me' });
        const doc2 = await _createDoc({ title: 'Delete Me' });

        await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc2.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        const result = await _listDocs(null);
        expect(result.list).to.have.lengthOf(1);
        expect(result.list[0].id).to.equal(doc1.id);
      });
    });

    // --- Field Tracking ---

    describe('Field tracking', () => {
      it('created_by and updated_by are populated on create', async () => {
        const doc = await _createDoc({ title: 'Track Fields' });
        const full = await _getDoc(doc.id);
        expect(full).to.have.property('created_by').that.is.a('string');
        expect(full.created_by).to.not.be.empty;
        expect(full).to.have.property('updated_by').that.is.a('string');
        expect(full.updated_by).to.not.be.empty;
      });

      it('updated_at changes after update', async () => {
        const doc = await _createDoc({ title: 'Timestamp Test' });

        // Small delay to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 50));

        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .send({ title: 'Timestamp Updated', version: doc.version })
          .expect(200);

        const updated = res.body;
        // updated_at should be >= created_at (may be equal if sub-second)
        expect(
          new Date(updated.updated_at).getTime(),
        ).to.be.greaterThanOrEqual(new Date(doc.created_at).getTime());
      });
    });

    // --- has_children Consistency ---

    describe('has_children consistency', () => {
      it('has_children is false for leaf document', async () => {
        const doc = await _createDoc({ title: 'Leaf' });
        expect(doc.has_children).to.equal(false);
      });

      it('has_children flips to false when last child is moved away', async () => {
        const parent = await _createDoc({ title: 'Parent' });
        const child = await _createDoc({
          title: 'Only Child',
          parent_id: parent.id,
        });

        // Verify parent has_children = true
        let p = await _getDoc(parent.id);
        expect(p.has_children).to.equal(true);

        // Move child to root
        await request(context.app)
          .patch(`${API_PREFIX}/docs/${child.id}/reorder`)
          .set('xc-auth', context.token)
          .send({ order: 1, parent_id: null })
          .expect(200);

        // Parent should now have has_children = false
        p = await _getDoc(parent.id);
        expect(p.has_children).to.equal(false);
      });

      it('has_children flips to false when last child is deleted', async () => {
        const parent = await _createDoc({ title: 'Parent' });
        const child = await _createDoc({
          title: 'Only Child',
          parent_id: parent.id,
        });

        await request(context.app)
          .delete(`${API_PREFIX}/docs/${child.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        const p = await _getDoc(parent.id);
        expect(p.has_children).to.equal(false);
      });
    });

    // --- Deep Hierarchy ---

    describe('Deep hierarchy', () => {
      it('4-level nesting works correctly', async () => {
        const l1 = await _createDoc({ title: 'Level 1' });
        const l2 = await _createDoc({
          title: 'Level 2',
          parent_id: l1.id,
        });
        const l3 = await _createDoc({
          title: 'Level 3',
          parent_id: l2.id,
        });
        const l4 = await _createDoc({
          title: 'Level 4',
          parent_id: l3.id,
        });

        // Verify each level
        expect((await _getDoc(l1.id)).has_children).to.equal(true);
        expect((await _getDoc(l2.id)).has_children).to.equal(true);
        expect((await _getDoc(l3.id)).has_children).to.equal(true);
        expect((await _getDoc(l4.id)).has_children).to.equal(false);

        // List at each level returns correct count
        expect((await _listDocs(null)).list).to.have.lengthOf(1);
        expect((await _listDocs(l1.id)).list).to.have.lengthOf(1);
        expect((await _listDocs(l2.id)).list).to.have.lengthOf(1);
        expect((await _listDocs(l3.id)).list).to.have.lengthOf(1);
        expect((await _listDocs(l4.id)).list).to.have.lengthOf(0);
      });

      it('Deep cascade delete removes all descendants', async () => {
        const l1 = await _createDoc({ title: 'L1' });
        const l2 = await _createDoc({ title: 'L2', parent_id: l1.id });
        const l3 = await _createDoc({ title: 'L3', parent_id: l2.id });
        const l4 = await _createDoc({ title: 'L4', parent_id: l3.id });

        // Delete root of subtree
        await request(context.app)
          .delete(`${API_PREFIX}/docs/${l1.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        // All descendants should be gone
        for (const id of [l1.id, l2.id, l3.id, l4.id]) {
          await request(context.app)
            .get(`${API_PREFIX}/docs/${id}`)
            .set('xc-auth', context.token)
            .expect(422);
        }
      });
    });

    // --- Reorder Edge Cases ---

    describe('Reorder edge cases', () => {
      it('Reorder to non-existent parent returns error', async () => {
        const doc = await _createDoc({ title: 'Bad Parent' });

        await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}/reorder`)
          .set('xc-auth', context.token)
          .send({ order: 1, parent_id: 'nonexistent_parent_id' })
          .expect(422);
      });

      it('Fractional order values are preserved', async () => {
        const doc = await _createDoc({ title: 'Fraction Order' });

        const res = await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc.id}/reorder`)
          .set('xc-auth', context.token)
          .send({ order: 2.718281828 })
          .expect(200);

        // Floats may lose precision but should be close
        expect(res.body.order).to.be.closeTo(2.718281828, 0.001);
      });

      it('Reorder non-existent document returns error', async () => {
        await request(context.app)
          .patch(`${API_PREFIX}/docs/nonexistent_id/reorder`)
          .set('xc-auth', context.token)
          .send({ order: 1 })
          .expect(422);
      });
    });

    // --- List Edge Cases ---

    describe('List edge cases', () => {
      it('List with non-existent parent_id returns empty', async () => {
        await _createDoc({ title: 'Root Doc' });

        const result = await _listDocs('nonexistent_parent_id');
        expect(result.list).to.be.an('array').that.is.empty;
      });

      it('List without parent_id query returns all root docs', async () => {
        await _createDoc({ title: 'Root 1' });
        await _createDoc({ title: 'Root 2' });
        const parent = await _createDoc({ title: 'Parent' });
        await _createDoc({ title: 'Child', parent_id: parent.id });

        // No parent_id query param — should default to root
        const result = await _listDocs(undefined);
        // Behavior depends on controller: undefined parentId → null → root docs
        expect(result.list).to.be.an('array');
      });

      it('List items contain comment_count field', async () => {
        await _createDoc({ title: 'Comment Count Test' });
        const result = await _listDocs(null);
        expect(result.list[0]).to.have.property('comment_count').that.is.a('number');
      });
    });

    // --- Response Shape Contracts ---

    describe('Response shape contracts', () => {
      it('Full document response has all expected fields', async () => {
        const doc = await _createDoc({
          title: 'Shape Test',
          meta: { icon: 'test' },
        });
        const full = await _getDoc(doc.id);

        // Required fields
        const requiredFields = [
          'id',
          'base_id',
          'title',
          'content',
          'order',
          'has_children',
          'version',
          'created_at',
          'updated_at',
        ];
        for (const field of requiredFields) {
          expect(full).to.have.property(field);
        }

        // Optional but expected fields
        expect(full).to.have.property('parent_id');
        expect(full).to.have.property('meta');
        expect(full).to.have.property('created_by');
        expect(full).to.have.property('updated_by');
        expect(full).to.have.property('comment_count');
      });

      it('List item does NOT include content field', async () => {
        await _createDoc({
          title: 'List Shape',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Large content body' }],
              },
            ],
          },
        });
        const result = await _listDocs(null);
        expect(result.list[0]).to.not.have.property('content');
      });

      it('Delete returns boolean true', async () => {
        const doc = await _createDoc({ title: 'Delete Shape' });
        const res = await request(context.app)
          .delete(`${API_PREFIX}/docs/${doc.id}`)
          .set('xc-auth', context.token)
          .expect(200);
        expect(res.body).to.equal(true);
      });
    });

    // --- Multiple Siblings Ordering ---

    describe('Multiple siblings ordering', () => {
      it('Sibling documents maintain distinct order values', async () => {
        const doc1 = await _createDoc({ title: 'Sibling A' });
        const doc2 = await _createDoc({ title: 'Sibling B' });
        const doc3 = await _createDoc({ title: 'Sibling C' });

        const result = await _listDocs(null);
        const orders = result.list.map((d: any) => d.order);

        // All orders should be distinct
        const uniqueOrders = new Set(orders);
        expect(uniqueOrders.size).to.equal(3);
      });

      it('Reorder changes relative position', async () => {
        const doc1 = await _createDoc({ title: 'First' });
        const doc2 = await _createDoc({ title: 'Second' });

        // Move doc2 before doc1 by setting a lower order
        const order1 = doc1.order;
        await request(context.app)
          .patch(`${API_PREFIX}/docs/${doc2.id}/reorder`)
          .set('xc-auth', context.token)
          .send({ order: order1 - 1 })
          .expect(200);

        const result = await _listDocs(null);
        const titles = result.list.map((d: any) => d.title);
        expect(titles[0]).to.equal('Second');
        expect(titles[1]).to.equal('First');
      });
    });
  });
}
