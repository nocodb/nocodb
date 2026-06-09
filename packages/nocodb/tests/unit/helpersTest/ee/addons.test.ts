import 'mocha';
import { expect } from 'chai';
import { PlanAddonTypes, PlanFeatureTypes, applyAddons } from 'nocodb-sdk';

export function addonTests() {
  describe('addons: applyAddons', () => {
    it('grants SCIM feature when ADDON_SCIM is active', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_SCIM]);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(true);
    });

    it('grants white-label feature when ADDON_WHITE_LABEL is active', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_WHITE_LABEL]);
      expect(meta[PlanFeatureTypes.FEATURE_WHITE_LABEL]).to.equal(true);
    });

    it('mutates in place and leaves unrelated features untouched', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
        [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_SCIM]);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(true);
      expect(meta[PlanFeatureTypes.FEATURE_WHITE_LABEL]).to.equal(false);
    });

    it('is a no-op for undefined active keys', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
      };
      applyAddons(meta, undefined);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(false);
    });

    it('is a no-op for an empty array', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
      };
      applyAddons(meta, []);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(false);
    });
  });
}
