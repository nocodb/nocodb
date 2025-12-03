import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

interface CreateScriptArgs {
  title: string;
  description?: string;
  script: string;
  config?: any;
}

export default function () {
  describe.only(`Scripts v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX: string;

    async function _createScript(args: CreateScriptArgs) {
      const response = await request(context.app)
        .post(`${API_PREFIX}/scripts`)
        .set('xc-auth', context.token)
        .send(args)
        .expect(201);

      return response.body;
    }

    async function _verifyScript(script: any, args: CreateScriptArgs) {
      expect(script).to.be.an('object');
      const requiredFields = [
        'id',
        'title',
        'base_id',
        'workspace_id',
        'script',
        'created_at',
        'updated_at',
        ...(args.description ? ['description'] : []),
      ];

      expect(Object.keys(script)).to.include.members(requiredFields);

      expect(script.id).to.be.a('string');
      expect(script.title).to.equal(args.title);
      if (args.description) {
        expect(script.description).to.equal(args.description);
      }
      expect(script.script).to.equal(args.script);
      expect(script.base_id).to.equal(initBase.id);
      expect(script.workspace_id).to.be.a('string');
    }

    const scriptData: CreateScriptArgs = {
      title: 'Test Script',
      description: 'A test script for unit testing',
      script: 'console.log("Hello World");',
      config: { timeout: 30000 },
    };

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'ScriptTestBase',
        })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
    });

    it('List Scripts v3', async () => {
      // Create multiple scripts
      await _createScript(scriptData);
      await _createScript({
        title: 'Script 2',
        description: 'Second script',
        script: 'console.log("Script 2");',
      });
      await _createScript({
        title: 'Script 3',
        description: 'Third script',
        script: 'console.log("Script 3");',
      });

      // List scripts
      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/scripts`)
        .set('xc-auth', context.token)
        .expect(200);

      const scripts = listResponse.body.list;
      expect(scripts).to.be.an('array').that.is.not.empty;
      expect(scripts).to.have.lengthOf(3);

      // Verify first script in list
      const firstScript = scripts.find((s) => s.title === 'Test Script');
      expect(firstScript).to.exist;
      expect(firstScript).to.have.property('id');
      expect(firstScript).to.have.property('title', 'Test Script');
      expect(firstScript).to.have.property(
        'description',
        'A test script for unit testing',
      );
      expect(firstScript).to.have.property('base_id', initBase.id);
      expect(firstScript).to.have.property('workspace_id');

      // List response should not include script content, config
      expect(firstScript).to.not.have.property('script');
      expect(firstScript).to.not.have.property('config');
    });

    it('Create Script v3', async () => {
      const scriptObj = await _createScript(scriptData);
      await _verifyScript(scriptObj, scriptData);

      // Minimal arguments
      const minimalData: CreateScriptArgs = {
        title: 'Minimal Script',
        script: 'console.log("minimal");',
      };
      const minimalScriptObj = await _createScript(minimalData);
      await _verifyScript(minimalScriptObj, minimalData);
    });

    it('Create Script v3 - with defaults', async () => {
      // Missing script field - should use default
      const scriptWithoutScript = await request(context.app)
        .post(`${API_PREFIX}/scripts`)
        .set('xc-auth', context.token)
        .send({
          title: 'Test Without Script',
        })
        .expect(201);

      expect(scriptWithoutScript.body).to.have.property('id');
      expect(scriptWithoutScript.body.title).to.equal('Test Without Script');
      expect(scriptWithoutScript.body).to.have.property('script');
      // Script should be populated with default value
      expect(scriptWithoutScript.body.script).to.be.a('string');
    });

    it('Read Script v3', async () => {
      const scriptObj = await _createScript(scriptData);

      // Get script
      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/scripts/${scriptObj.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      const script = getResponse.body;
      await _verifyScript(script, scriptData);

      // Verify script content is included in get response
      expect(script.script).to.equal(scriptData.script);
      expect(script.config).to.deep.equal(scriptData.config);
    });

    it('Read Script v3 - not found', async () => {
      // Non-existent script ID
      const errNotFound = await request(context.app)
        .get(`${API_PREFIX}/scripts/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(422);

      expect(errNotFound.body).to.have.property('error');
      expect(errNotFound.body).to.have.property('message');
    });

    it('Update Script v3', async () => {
      const scriptObj = await _createScript(scriptData);

      // Update script
      const updateData: CreateScriptArgs = {
        title: 'Updated Script',
        description: 'Updated description',
        script: 'console.log("Updated");',
        config: { timeout: 60000 },
      };

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/scripts/${scriptObj.id}`)
        .set('xc-auth', context.token)
        .send(updateData)
        .expect(200);

      const updatedScript = updateResponse.body;
      await _verifyScript(updatedScript, updateData);

      // Verify the script was actually updated by fetching it again
      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/scripts/${scriptObj.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(getResponse.body.title).to.equal('Updated Script');
      expect(getResponse.body.script).to.equal('console.log("Updated");');
    });

    it('Update Script v3 - partial update', async () => {
      const scriptObj = await _createScript(scriptData);

      // Update only title
      const partialUpdate = {
        title: 'Partially Updated',
        description: scriptData.description,
        script: scriptData.script,
      };

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/scripts/${scriptObj.id}`)
        .set('xc-auth', context.token)
        .send(partialUpdate)
        .expect(200);

      expect(updateResponse.body.title).to.equal('Partially Updated');
      expect(updateResponse.body.script).to.equal(scriptData.script);
    });

    it('Update Script v3 - not found', async () => {
      // Update non-existent script
      const errNotFound = await request(context.app)
        .patch(`${API_PREFIX}/scripts/nonexistent_id`)
        .set('xc-auth', context.token)
        .send({
          title: 'Updated',
          script: 'console.log("test");',
        })
        .expect(422);

      expect(errNotFound.body).to.have.property('error');
    });

    it('Delete Script v3', async () => {
      const scriptObj = await _createScript(scriptData);

      // Delete script
      await request(context.app)
        .delete(`${API_PREFIX}/scripts/${scriptObj.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify script is deleted by trying to get it
      await request(context.app)
        .get(`${API_PREFIX}/scripts/${scriptObj.id}`)
        .set('xc-auth', context.token)
        .expect(422);
    });

    it('Delete Script v3 - not found', async () => {
      // Delete non-existent script
      const errNotFound = await request(context.app)
        .delete(`${API_PREFIX}/scripts/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(422);

      expect(errNotFound.body).to.have.property('error');
    });

    it('Multiple operations v3', async () => {
      // Create
      await _createScript({
        title: 'Script 1',
        script: 'console.log("1");',
      });
      const script2 = await _createScript({
        title: 'Script 2',
        script: 'console.log("2");',
      });
      const script3 = await _createScript({
        title: 'Script 3',
        script: 'console.log("3");',
      });

      // List - should have 3 scripts
      let listResponse = await request(context.app)
        .get(`${API_PREFIX}/scripts`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(listResponse.body.list).to.have.lengthOf(3);

      // Update one
      await request(context.app)
        .patch(`${API_PREFIX}/scripts/${script2.id}`)
        .set('xc-auth', context.token)
        .send({
          title: 'Script 2 Updated',
          script: 'console.log("2 updated");',
        })
        .expect(200);

      // Delete one
      await request(context.app)
        .delete(`${API_PREFIX}/scripts/${script3.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // List - should have 2 scripts now
      listResponse = await request(context.app)
        .get(`${API_PREFIX}/scripts`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(listResponse.body.list).to.have.lengthOf(2);

      // Verify the updated script
      const updatedScript = listResponse.body.list.find(
        (s) => s.id === script2.id,
      );
      expect(updatedScript.title).to.equal('Script 2 Updated');
    });
  });
}
