import { PlanFeatureTypes } from '~/lib/payment';
import { NcErrorBase } from '~/lib/error-handler/nc-error-base';

const messageFor = (isOnPrem: boolean) => {
  try {
    new NcErrorBase().featureNotSupported({
      feature: PlanFeatureTypes.FEATURE_ENTERPRISE_VAULTS,
      isOnPrem,
    });
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('expected a throw');
};

describe('add-on-only feature denial', () => {
  it('points cloud users at sales, not a billing page with no purchase', () => {
    const message = messageFor(false);
    expect(message).toBe(
      'Enterprise Vaults require the Enterprise Vaults add-on. Contact sales to add it to your plan.'
    );
    expect(message).not.toContain('billing settings');
  });

  it('points on-prem users at their license', () => {
    expect(messageFor(true)).toContain(
      'Contact sales to add it to your license.'
    );
  });
});
