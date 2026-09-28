import { ChartTypes } from './charts';
import {
  findPlottedRightYAxisField,
  findRightYAxisField,
  hasVisibleRightYAxis,
  isRightYAxisField,
  isXYChartFieldPlotted,
  leftYAxisFields,
  xyChartSeriesType,
} from './charts';
import type { XYChartYAxisField } from './charts';

/**
 * These helpers are the contract the properties pane and the renderer share —
 * the renderer joins backend series to config BY POSITION, so a disagreement
 * silently re-axises or recolours every series.
 */
describe('xy chart y-axis field helpers', () => {
  const left = (over: Partial<XYChartYAxisField> = {}): XYChartYAxisField => ({
    column_id: 'c_left',
    aggregation: 'sum',
    ...over,
  });

  const right = (over: Partial<XYChartYAxisField> = {}): XYChartYAxisField => ({
    column_id: 'c_right',
    aggregation: 'avg',
    axis: 'right',
    ...over,
  });

  describe('isRightYAxisField', () => {
    it('treats an untagged entry as left — the pre-secondary-axis shape', () => {
      expect(isRightYAxisField(left())).toBe(false);
    });

    it('treats an explicit left tag as left', () => {
      expect(isRightYAxisField(left({ axis: 'left' }))).toBe(false);
    });

    it('detects the right tag', () => {
      expect(isRightYAxisField(right())).toBe(true);
    });
  });

  describe('leftYAxisFields', () => {
    it('keeps untagged and left-tagged entries, in order', () => {
      const a = left({ column_id: 'a' });
      const b = left({ column_id: 'b', axis: 'left' });

      expect(leftYAxisFields([a, right(), b])).toEqual([a, b]);
    });

    it('returns empty for undefined fields', () => {
      expect(leftYAxisFields(undefined)).toEqual([]);
    });
  });

  describe('isXYChartFieldPlotted', () => {
    it('always plots a left entry — it has no show toggle', () => {
      expect(isXYChartFieldPlotted(left())).toBe(true);
      expect(isXYChartFieldPlotted(left({ show: false }))).toBe(true);
    });

    it('plots a right entry unless show is explicitly false', () => {
      expect(isXYChartFieldPlotted(right())).toBe(true);
      expect(isXYChartFieldPlotted(right({ show: true }))).toBe(true);
      expect(isXYChartFieldPlotted(right({ show: false }))).toBe(false);
    });
  });

  describe('findRightYAxisField vs findPlottedRightYAxisField', () => {
    it('the editable lookup returns a hidden entry, the render lookup does not', () => {
      const hidden = right({ show: false });
      const fields = [left(), hidden];

      expect(findRightYAxisField(fields)).toBe(hidden);
      expect(findPlottedRightYAxisField(fields)).toBeUndefined();
    });

    it('the render lookup skips a hidden entry to reach a plotted one', () => {
      const hidden = right({ column_id: 'hidden', show: false });
      const shown = right({ column_id: 'shown' });

      expect(findRightYAxisField([hidden, shown])).toBe(hidden);
      expect(findPlottedRightYAxisField([hidden, shown])).toBe(shown);
    });

    it('returns undefined when no entry is tagged right', () => {
      expect(findRightYAxisField([left(), left()])).toBeUndefined();
      expect(findPlottedRightYAxisField([left(), left()])).toBeUndefined();
    });
  });

  describe('hasVisibleRightYAxis', () => {
    it('is false with no right entry, or one switched off', () => {
      expect(hasVisibleRightYAxis(undefined)).toBe(false);
      expect(hasVisibleRightYAxis([left()])).toBe(false);
      expect(hasVisibleRightYAxis([left(), right({ show: false })])).toBe(
        false
      );
    });

    it('is true once a right entry is configured and on', () => {
      expect(hasVisibleRightYAxis([left(), right()])).toBe(true);
    });
  });

  describe('xyChartSeriesType', () => {
    it('pins a left entry to the widget type, even with a series_type set', () => {
      expect(xyChartSeriesType(left(), ChartTypes.BAR)).toBe(ChartTypes.BAR);
      expect(
        xyChartSeriesType(
          left({ series_type: ChartTypes.LINE }),
          ChartTypes.BAR
        )
      ).toBe(ChartTypes.BAR);
    });

    it('lets a right entry override — a line riding over bars', () => {
      expect(
        xyChartSeriesType(
          right({ series_type: ChartTypes.LINE }),
          ChartTypes.BAR
        )
      ).toBe(ChartTypes.LINE);
    });

    it('falls back to the widget type when a right entry sets none', () => {
      expect(xyChartSeriesType(right(), ChartTypes.SCATTER)).toBe(
        ChartTypes.SCATTER
      );
    });
  });

  describe('positional join invariants the renderer depends on', () => {
    it('left entries keep their index across the full array', () => {
      const fields = [
        left({ column_id: 'a' }),
        right(),
        left({ column_id: 'b' }),
      ];

      // The pane writes [...left, right], but the renderer must survive any
      // order — it reads fields[i] for series[i].
      expect(fields.map(isRightYAxisField)).toEqual([false, true, false]);
      expect(leftYAxisFields(fields).map((f) => f.column_id)).toEqual([
        'a',
        'b',
      ]);
    });

    it('a hidden right entry still occupies its index', () => {
      const fields = [left(), right({ show: false })];

      // The backend aggregates every entry, so index 1 exists in the response
      // and must be dropped by plot-check, not by shifting indices.
      expect(fields).toHaveLength(2);
      expect(fields.map(isXYChartFieldPlotted)).toEqual([true, false]);
    });
  });
});
