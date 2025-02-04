import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';
import { isEE } from 'playwright/setup/db';

interface CreateBaseArgs {
  title: string;
  description?: string;
  meta?: {
    icon_color?: string;
  };
}

export default function () {
  describe(`Base v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;

    async function _createBase(args: CreateBaseArgs) {
      const workspaceId = context.fk_workspace_id;

      // create base
      const base = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send(args)
        .expect(201);

      return base.body;
    }
    async function _verifyBase(base: any, args: CreateBaseArgs) {
      // Check response object exists
      // Verify all required properties exist
      expect(base).to.be.an('object');
      expect(Object.keys(base)).to.include.members([
        'id',
        'title',
        'meta',
        'created_at',
        'updated_at',
        ...(isEE()?
        ['workspace_id'] :[])
      ]);

      // Optionally check for 'description' if it exists
      if (Object.prototype.hasOwnProperty.call(base, 'description')) {
        expect(base.description).to.be.a('string');
      }

      const {
        id,
        title,
        description,
        meta,
        created_at,
        updated_at,
        workspace_id,
      } = base;

      // Verify essential fields
      expect(id).to.match(/^p[a-z0-9]{14}$/);
      expect(title).to.equal(args.title);
      expect(description).to.equal(args.description);
      expect(meta).to.deep.equal({
        icon_color: args.meta?.icon_color || '#36BFFF',
      });
      expect(new Date(created_at)).to.be.a('date');
      expect(new Date(updated_at)).to.be.a('date');
      if(isEE())
      expect(workspace_id).to.equal(context.fk_workspace_id);
    }

    // Sample reference for base data
    const baseData = {
      title: 'Test Base',
      description: 'Test Description',
      meta: {
        icon_color: '#123456',
      },
    };

    beforeEach(async () => {
      context = await init();
    });

    it('List Base v3', async () => {
      await _createBase(baseData);
      await _createBase(baseData);
      await _createBase(baseData);

      // create base
      const workspaceId = context.fk_workspace_id;
      const listBase = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // console.log(JSON.stringify(listBase.body, null, 2));

      // Validation
      const bases = listBase.body.list;
      expect(bases).to.be.an('array').that.is.not.empty;

      // There is one default base created for the workspace
      expect(bases).to.have.lengthOf(4);

      if(isEE()) {
        // ensure all the bases have same WS ID (=workspaceId)
        bases.forEach((base) => {
          expect(base).to.have.property('workspace_id', workspaceId);
        });
      }

      // Validate count of bases created for the current workspace
      // Skip default base created for the workspace
      const workspaceBases = bases.filter((base) => base.title === 'Test Base');
      expect(workspaceBases).to.have.lengthOf(3);

      // Validate each base
      workspaceBases.forEach((base) => {
        expect(base).to.have.property('title', 'Test Base');
        expect(base).to.have.property('description', 'Test Description');
        expect(base.meta).to.have.property('icon_color', '#123456');
        if(isEE()) {
          expect(base).to.have.property('workspace_id', workspaceId);
        }
        expect(new Date(base.created_at)).to.be.a('date');
        expect(new Date(base.updated_at)).to.be.a('date');
      });
    });
    it('Create Base v3', async () => {
      const baseObj = await _createBase(baseData);
      await _verifyBase(baseObj, baseData);

      // minimal arguments
      const baseDataMinimal = {
        title: 'Test Base Minimal',
      };
      const baseObjMinimal = await _createBase(baseDataMinimal);
      await _verifyBase(baseObjMinimal, baseDataMinimal);

      if(isEE()) {
        // Invalid Workspace ID
        const err = await request(context.app)
          .post(`/api/v3/meta/workspaces/invalidId/bases`)
          .set('xc-token', context.xc_token)
          .send(baseDataMinimal)
          .expect(404);

      // validate error response
      expect(Object.keys(err.body)).to.include.members(['error', 'message']);
      expect(err.body.error).to.equal('WORKSPACE_NOT_FOUND');
      expect(err.body.message).to.equal("Workspace 'invalidId' not found");
      }

      // base name exceeds 255 characters
      const baseDataLong = {
        title: 'Test Base Long'.repeat(100),
      };
      const errLong = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/bases`)
        .set('xc-token', context.xc_token)
        .send(baseDataLong)
        .expect(400);

      // validate error response
      expect(Object.keys(errLong.body)).to.include.members(['msg', 'errors']);
      expect(errLong.body.msg).to.equal('Invalid request body');
      expect(errLong.body.errors[0].message).to.equal(
        'must NOT have more than 50 characters',
      );
    });
    it('Read Base v3', async () => {
      const baseObj = await _createBase(baseData);

      // Get base
      const getBase = await request(context.app)
        .get(`/api/v3/meta/bases/${baseObj.id}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // console.log(JSON.stringify(getBase.body, null, 2));

      // Validation
      const base = getBase.body;
      await _verifyBase(base, baseData);
    });
    it('Update Base v3', async () => {
      const baseObj = await _createBase(baseData);

      // Update base
      const updateData = {
        title: 'Updated Base',
        description: 'Updated Description',
        meta: {
          icon_color: '#abcdef',
        },
      };

      const updateBase = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseObj.id}`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // console.log(JSON.stringify(updateBase.body, null, 2));

      // Validation
      const updatedBase = updateBase.body;
      await _verifyBase(updatedBase, updateData);
    });
    it('Delete Base v3', async () => {
      const baseObj = await _createBase(baseData);

      // Delete base
      await request(context.app)
        .delete(`/api/v3/meta/bases/${baseObj.id}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Get base
      await request(context.app)
        .get(`/api/v3/meta/bases/${baseObj.id}`)
        .set('xc-token', context.xc_token)
        .expect(404);
    });
  });
}
