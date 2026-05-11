import { expect } from 'chai';
import {
  dynamicScope,
  scopeBase,
  scopeDashboard,
  scopeScript,
  scopeTable,
  scopeView,
  scopeWorkflow,
  SIDEBAR_FIELDS,
} from '../../../src/command-registry/scope';
import type { NcContext } from '../../../src/interface/config';

describe('scope helpers', () => {
  describe('builders', () => {
    it('scopeBase returns base+context.base_id', () => {
      const ctx = { base_id: 'p_abc' } as NcContext;
      expect(scopeBase(ctx)).to.deep.equal({ type: 'base', id: 'p_abc' });
    });

    it('scopeBase throws when base_id is missing', () => {
      expect(() => scopeBase({} as NcContext)).to.throw(/base_id/);
    });

    it('scopeTable / scopeView / scopeDashboard / scopeWorkflow / scopeScript', () => {
      expect(scopeTable('mdl_1')).to.deep.equal({ type: 'table', id: 'mdl_1' });
      expect(scopeView('vw_1')).to.deep.equal({ type: 'view', id: 'vw_1' });
      expect(scopeDashboard('db_1')).to.deep.equal({
        type: 'dashboard',
        id: 'db_1',
      });
      expect(scopeWorkflow('wf_1')).to.deep.equal({
        type: 'workflow',
        id: 'wf_1',
      });
      expect(scopeScript('sc_1')).to.deep.equal({ type: 'script', id: 'sc_1' });
    });
  });

  describe('dynamicScope', () => {
    const base = scopeBase({ base_id: 'p_abc' } as NcContext);
    const view = scopeView('vw_1');
    const dashboard = scopeDashboard('db_1');
    const workflow = scopeWorkflow('wf_1');
    const script = scopeScript('sc_1');

    it('viewUpdate: title-only → BASE', () => {
      expect(dynamicScope('viewUpdate', { title: 'New' }, base, view)).to.equal(
        base,
      );
    });

    it('viewUpdate: lock_type-only → BASE', () => {
      expect(
        dynamicScope('viewUpdate', { lock_type: 'locked' }, base, view),
      ).to.equal(base);
    });

    it('viewUpdate: fk_view_section_id-only → BASE', () => {
      expect(
        dynamicScope(
          'viewUpdate',
          { fk_view_section_id: 'sec_1' },
          base,
          view,
        ),
      ).to.equal(base);
    });

    it('viewUpdate: all 3 sidebar fields together → BASE', () => {
      expect(
        dynamicScope(
          'viewUpdate',
          { title: 'x', lock_type: 'locked', fk_view_section_id: 's' },
          base,
          view,
        ),
      ).to.equal(base);
    });

    it('viewUpdate: title + meta → VIEW (any non-sidebar key flips)', () => {
      expect(
        dynamicScope(
          'viewUpdate',
          { title: 'x', meta: { foo: 1 } },
          base,
          view,
        ),
      ).to.equal(view);
    });

    it('viewUpdate: meta-only → VIEW', () => {
      expect(
        dynamicScope('viewUpdate', { meta: { foo: 1 } }, base, view),
      ).to.equal(view);
    });

    it('viewUpdate: empty body → BASE (no-op rename)', () => {
      expect(dynamicScope('viewUpdate', {}, base, view)).to.equal(base);
    });

    it('viewUpdate: null body → BASE', () => {
      expect(dynamicScope('viewUpdate', null, base, view)).to.equal(base);
    });

    it('dashboardUpdate: title-only → BASE', () => {
      expect(
        dynamicScope('dashboardUpdate', { title: 'x' }, base, dashboard),
      ).to.equal(base);
    });

    it('dashboardUpdate: any other key → DASHBOARD', () => {
      expect(
        dynamicScope(
          'dashboardUpdate',
          { title: 'x', layout: [] },
          base,
          dashboard,
        ),
      ).to.equal(dashboard);
    });

    it('workflowUpdate: title-only → BASE', () => {
      expect(
        dynamicScope('workflowUpdate', { title: 'x' }, base, workflow),
      ).to.equal(base);
    });

    it('workflowUpdate: nodes → WORKFLOW', () => {
      expect(
        dynamicScope('workflowUpdate', { nodes: [] }, base, workflow),
      ).to.equal(workflow);
    });

    it('scriptUpdate: title-only → BASE; code → SCRIPT', () => {
      expect(
        dynamicScope('scriptUpdate', { title: 'x' }, base, script),
      ).to.equal(base);
      expect(
        dynamicScope('scriptUpdate', { script: 'console.log(1)' }, base, script),
      ).to.equal(script);
    });
  });

  describe('SIDEBAR_FIELDS', () => {
    it('every op has at least one sidebar field', () => {
      for (const [op, fields] of Object.entries(SIDEBAR_FIELDS)) {
        expect(
          fields.size,
          `${op} should have ≥ 1 sidebar field`,
        ).to.be.greaterThan(0);
      }
    });

    it('title is always a sidebar field for every dynamic op', () => {
      for (const [op, fields] of Object.entries(SIDEBAR_FIELDS)) {
        expect(fields.has('title'), `${op} missing title`).to.equal(true);
      }
    });
  });
});
