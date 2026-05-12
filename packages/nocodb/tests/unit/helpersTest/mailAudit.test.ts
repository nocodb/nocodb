import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { MailService } from 'src/services/mail/mail.service';
import { MailEvent } from 'src/interface/Mail';
import { MetaTable, RootScopes } from 'src/utils/globals';

// Subclass exposes the protected helper for direct testing.
class TestMailService extends MailService {
  public async callDispatchAndLog(adapter: any, ncMeta: any, args: any) {
    return (this as any).dispatchAndLog(adapter, ncMeta, args);
  }
}

function mailAuditTests() {
  describe('MailService audit logging', () => {
    let service: TestMailService;
    let adapter: { mailSend: sinon.SinonStub };
    let ncMeta: { metaInsert2: sinon.SinonStub };

    beforeEach(() => {
      service = new TestMailService();
      adapter = { mailSend: sinon.stub().resolves() };
      ncMeta = { metaInsert2: sinon.stub().resolves() };
    });

    it('writes status=sent on successful send', async () => {
      await service.callDispatchAndLog(adapter, ncMeta, {
        event: MailEvent.VERIFY_EMAIL,
        fk_user_id: 'us_test',
        to: 'a@b.com',
        subject: 'Verify',
        html: '<p>hi</p>',
      });

      expect(adapter.mailSend.calledOnce).to.be.true;
      expect(ncMeta.metaInsert2.calledOnce).to.be.true;

      const [ws, base, table, row] = ncMeta.metaInsert2.getCall(0).args;
      expect(ws).to.equal(RootScopes.ROOT);
      expect(base).to.equal(RootScopes.ROOT);
      expect(table).to.equal(MetaTable.MAIL_SENDS);
      expect(row.status).to.equal('sent');
      expect(row.event).to.equal(MailEvent.VERIFY_EMAIL);
      expect(row.fk_user_id).to.equal('us_test');
      expect(row.to_email).to.equal('a@b.com');
      expect(row.subject).to.equal('Verify');
      expect(row.sent_at).to.be.instanceOf(Date);
      expect(row.error).to.be.null;
    });

    it('writes status=failed and re-throws on adapter error', async () => {
      const err = new Error('SES 5xx');
      adapter.mailSend.rejects(err);

      let thrown: Error | undefined;
      try {
        await service.callDispatchAndLog(adapter, ncMeta, {
          event: MailEvent.VERIFY_EMAIL,
          fk_user_id: 'us_x',
          to: 'a@b.com',
          subject: 'Verify',
          html: '<p>hi</p>',
        });
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown).to.equal(err);
      expect(ncMeta.metaInsert2.calledOnce).to.be.true;
      const row = ncMeta.metaInsert2.getCall(0).args[3];
      expect(row.status).to.equal('failed');
      expect(row.error).to.contain('SES 5xx');
      expect(row.sent_at).to.be.null;
    });

    it('skips audit row for FORM_SUBMISSION (user-content)', async () => {
      await service.callDispatchAndLog(adapter, ncMeta, {
        event: MailEvent.FORM_SUBMISSION,
        to: 'lead@example.com',
        subject: 'Form',
        html: '<p>data</p>',
      });

      expect(adapter.mailSend.calledOnce).to.be.true;
      expect(ncMeta.metaInsert2.called).to.be.false;
    });

    it('skips audit row for SEND_RECORD (user-content)', async () => {
      await service.callDispatchAndLog(adapter, ncMeta, {
        event: MailEvent.SEND_RECORD,
        to: 'lead@example.com',
        subject: 'Record',
        html: '<p>data</p>',
      });

      expect(adapter.mailSend.calledOnce).to.be.true;
      expect(ncMeta.metaInsert2.called).to.be.false;
    });

    it('skipped event still re-throws on adapter error (no audit row written)', async () => {
      const err = new Error('SES 5xx');
      adapter.mailSend.rejects(err);

      let thrown: Error | undefined;
      try {
        await service.callDispatchAndLog(adapter, ncMeta, {
          event: MailEvent.SEND_RECORD,
          to: 'lead@example.com',
          subject: 'Record',
          html: '<p>data</p>',
        });
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown).to.equal(err);
      expect(ncMeta.metaInsert2.called).to.be.false;
    });

    it('audit-row INSERT failure does not propagate when send succeeded', async () => {
      ncMeta.metaInsert2.rejects(new Error('PG down'));

      // Should NOT throw — email was sent; audit-write failure is logged only.
      await service.callDispatchAndLog(adapter, ncMeta, {
        event: MailEvent.WELCOME,
        fk_user_id: 'us_y',
        to: 'a@b.com',
        subject: 'Welcome',
        html: '<p>hi</p>',
      });

      expect(adapter.mailSend.calledOnce).to.be.true;
      expect(ncMeta.metaInsert2.calledOnce).to.be.true;
    });

    it('truncates error message at 8000 chars', async () => {
      const longMsg = 'x'.repeat(20000);
      adapter.mailSend.rejects(new Error(longMsg));

      try {
        await service.callDispatchAndLog(adapter, ncMeta, {
          event: MailEvent.WELCOME,
          fk_user_id: 'us_z',
          to: 'a@b.com',
          subject: 'W',
          html: '<p>hi</p>',
        });
      } catch {
        // expected
      }

      const row = ncMeta.metaInsert2.getCall(0).args[3];
      expect(row.error.length).to.equal(8000);
    });
  });
}

export { mailAuditTests };
