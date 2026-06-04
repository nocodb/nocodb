import 'mocha';
import { expect } from 'chai';
import {
  PlanTitles,
  getMinSeats,
  getSeatPriceCap,
  getChargeableSeats,
} from 'nocodb-sdk';

function seatConfigTests() {
  describe('seat config helpers', () => {
    it('getMinSeats: Scale is 3, others default to 1', () => {
      expect(getMinSeats(PlanTitles.SCALE)).to.eq(3);
      expect(getMinSeats(PlanTitles.PLUS)).to.eq(1);
      expect(getMinSeats(PlanTitles.BUSINESS)).to.eq(1);
      expect(getMinSeats(PlanTitles.ENTERPRISE)).to.eq(1);
      expect(getMinSeats(undefined)).to.eq(1);
    });

    it('getSeatPriceCap: only Plus & Business carry the legacy cap', () => {
      expect(getSeatPriceCap(PlanTitles.PLUS)).to.eq(9);
      expect(getSeatPriceCap(PlanTitles.BUSINESS)).to.eq(9);
      expect(getSeatPriceCap(PlanTitles.SCALE)).to.eq(null);
      expect(getSeatPriceCap(PlanTitles.ENTERPRISE)).to.eq(null);
    });

    it('getChargeableSeats: Scale floors at 3 and never caps', () => {
      expect(getChargeableSeats(PlanTitles.SCALE, 1)).to.eq(3);
      expect(getChargeableSeats(PlanTitles.SCALE, 3)).to.eq(3);
      expect(getChargeableSeats(PlanTitles.SCALE, 20)).to.eq(20);
    });

    it('getChargeableSeats: Plus/Business cap at 9, floor at 1', () => {
      expect(getChargeableSeats(PlanTitles.PLUS, 50)).to.eq(9);
      expect(getChargeableSeats(PlanTitles.BUSINESS, 2)).to.eq(2);
      expect(getChargeableSeats(PlanTitles.BUSINESS, 0)).to.eq(1);
    });
  });
}

export { seatConfigTests };
