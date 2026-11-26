import type { ColumnType } from './Api';
import { RelationTypes } from './globals';
import UITypes from './UITypes';
import {
  computeUtilization,
  countCountedDays,
  dateStringToDayNumber,
  dayNumberWeekday,
  formatUtilizationPercent,
  groupUtilizationPercent,
  instantToDayNumber,
  isLinkUtilizationPreviewComplete,
  isUtilizationResourceLink,
  isUtilizationSummaryComplete,
  isUtilizationTimeOffLink,
  isUtilizationTimeOffSource,
  MONDAY_TO_FRIDAY,
  orderGroupsByUtilization,
  remapDateAxisSummaryIds,
  toCapacity,
  utilizationColor,
  utilizationPercent,
  workingDayMask,
} from './timelineUtilization';

const day = dateStringToDayNumber;

// Mon 2026-09-07 … Sun 2026-09-13, Mon 2026-09-14 … Sun 2026-09-20
const week1 = { startDay: day('2026-09-07'), endDay: day('2026-09-14') };
const week2 = { startDay: day('2026-09-14'), endDay: day('2026-09-21') };

describe('timelineUtilization', () => {
  it('maps dates to weekdays', () => {
    expect(dayNumberWeekday(day('2026-09-07'))).toBe(1);
    expect(dayNumberWeekday(day('2026-09-13'))).toBe(0);
    expect(dayNumberWeekday(0)).toBe(4);
  });

  it('converts instants in a timezone to local days', () => {
    const ms = Date.UTC(2026, 8, 7, 20, 0); // 20:00Z = 01:30 next day in +05:30
    expect(instantToDayNumber(ms, 330)).toBe(day('2026-09-08'));
    expect(instantToDayNumber(ms, 0)).toBe(day('2026-09-07'));
  });

  it('counts workdays across partial weeks', () => {
    const monFri = workingDayMask(MONDAY_TO_FRIDAY);
    expect(countCountedDays(week1.startDay, week1.endDay - 1, monFri)).toBe(5);
    expect(countCountedDays(day('2026-09-11'), day('2026-09-15'), monFri)).toBe(
      3
    );
    expect(
      countCountedDays(day('2026-09-11'), day('2026-09-15'), workingDayMask())
    ).toBe(5);
  });

  it('pro-rates a weekly allocation over the days it covers', () => {
    const res = computeUtilization({
      buckets: [week1, week2],
      tasks: [
        {
          fromDay: day('2026-09-07'),
          toDay: day('2026-09-20'),
          allocated: 20,
          resources: ['a'],
          available: 40,
        },
      ],
      allocatedRate: 'week',
      availableRate: 'week',
    });
    const a = res.groups.find((g) => g.key === 'a')!;
    expect(a.buckets[0]).toMatchObject({ allocated: 20, available: 40 });
    expect(utilizationPercent(a.buckets[0])).toBe(50);
    expect(a.total).toMatchObject({ allocated: 40, available: 80 });
  });

  it('spreads a total over the task span and sums overlapping tasks', () => {
    const res = computeUtilization({
      buckets: [week1],
      tasks: [
        {
          fromDay: day('2026-09-07'),
          toDay: day('2026-09-11'),
          allocated: 30,
          resources: ['a'],
        },
        {
          fromDay: day('2026-09-10'),
          toDay: day('2026-09-10'),
          allocated: 8,
          resources: ['a'],
        },
      ],
      allocatedRate: 'total',
      availableRate: 'week',
      availableValue: 40,
      workingDays: MONDAY_TO_FRIDAY,
    });
    const a = res.groups[0];
    expect(a.buckets[0].allocated).toBeCloseTo(38);
    expect(a.buckets[0].available).toBeCloseTo(40);
    expect(Math.round(utilizationPercent(a.buckets[0])!)).toBe(95);
  });

  it('ignores weekends with workdays only', () => {
    const res = computeUtilization({
      buckets: [{ startDay: day('2026-09-12'), endDay: day('2026-09-13') }],
      tasks: [
        {
          fromDay: day('2026-09-12'),
          allocated: 4,
          resources: ['a'],
          available: 8,
        },
      ],
      allocatedRate: 'day',
      availableRate: 'day',
      workingDays: MONDAY_TO_FRIDAY,
    });
    expect(res.groups[0].buckets[0]).toMatchObject({
      allocated: 0,
      available: 0,
    });
    expect(utilizationPercent(res.groups[0].buckets[0])).toBeNull();
  });

  it('removes time off from capacity and flags days with work', () => {
    const res = computeUtilization({
      buckets: [week1],
      tasks: [
        {
          fromDay: day('2026-09-07'),
          toDay: day('2026-09-09'),
          allocated: 8,
          resources: ['a'],
          available: 8,
        },
      ],
      timeOff: [
        { resource: 'a', fromDay: day('2026-09-09'), toDay: day('2026-09-10') },
      ],
      allocatedRate: 'day',
      availableRate: 'day',
      workingDays: MONDAY_TO_FRIDAY,
    });
    const cell = res.groups[0].buckets[0];
    expect(cell.allocated).toBe(24);
    expect(cell.available).toBe(24); // 5 workdays − 2 off
    expect(cell.time_off).toBe(1); // only the 9th has work
  });

  it('splits or duplicates work across several resources', () => {
    const base = {
      buckets: [week1],
      tasks: [
        {
          fromDay: day('2026-09-07'),
          toDay: day('2026-09-13'),
          allocated: 10,
          resources: ['a', 'b'],
        },
      ],
      allocatedRate: 'week' as const,
      availableRate: 'week' as const,
      availableValue: 40,
    };
    const split = computeUtilization({ ...base, multipleResources: 'split' });
    expect(split.groups.map((g) => g.buckets[0].allocated)).toEqual([5, 5]);
    const full = computeUtilization({ ...base, multipleResources: 'full' });
    expect(full.groups.map((g) => g.buckets[0].allocated)).toEqual([10, 10]);
    expect(full.buckets[0]).toMatchObject({ allocated: 20, available: 80 });
  });

  it('honours a Sunday–Thursday working week', () => {
    const res = computeUtilization({
      buckets: [week1],
      tasks: [
        {
          fromDay: day('2026-09-07'),
          toDay: day('2026-09-13'),
          allocated: 20,
          resources: ['a'],
          available: 40,
        },
      ],
      allocatedRate: 'total',
      availableRate: 'week',
      workingDays: [0, 1, 2, 3, 4],
    });
    // Mon–Thu + Sun count; Fri 11th and Sat 12th don't.
    expect(res.groups[0].buckets[0]).toMatchObject({
      allocated: 20,
      available: 40,
    });
  });

  it('stays linear on dense, long windows', () => {
    const buckets = Array.from({ length: 150 }, (_, i) => ({
      startDay: 20000 + i * 24,
      endDay: 20000 + (i + 1) * 24,
    }));
    const tasks = Array.from({ length: 50_000 }, (_, i) => ({
      fromDay: 20000 + (i % 3000),
      toDay: 20000 + (i % 3000) + 400,
      allocated: 8,
      resources: [`r${i % 200}`],
    }));
    const started = Date.now();
    const res = computeUtilization({
      buckets,
      tasks,
      allocatedRate: 'day',
      availableRate: 'week',
      availableValue: 40,
    });
    expect(res.groups).toHaveLength(200);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('remaps a summary onto a copied base', () => {
    const ids: Record<string, string> = {
      hours: 'h2',
      person: 'p2',
      cap: 'c2',
      off: 'o2',
      offLink: 'ol2',
      offStart: 'os2',
    };
    const summary = {
      fk_column_id: 'hours',
      aggregation: 'utilization',
      utilization: {
        allocated_rate: 'week' as const,
        available_rate: 'week' as const,
        fk_resource_column_id: 'person',
        fk_available_column_id: 'cap',
        time_off: {
          fk_model_id: 'off',
          fk_link_column_id: 'offLink',
          fk_start_column_id: 'offStart',
          fk_end_column_id: 'offEnd',
        },
      },
    };
    const remapped = remapDateAxisSummaryIds(summary, (id) => ids[id]);
    expect(remapped?.fk_column_id).toBe('h2');
    expect(remapped?.utilization).toMatchObject({
      fk_resource_column_id: 'p2',
      fk_available_column_id: 'c2',
      time_off: null, // its end-date field has no counterpart
    });
    expect(
      remapDateAxisSummaryIds(summary, (id) =>
        id === 'person' ? null : ids[id]
      )
    ).toBeUndefined();
  });

  it('remaps a time-off amount field, dropping time off when it has no counterpart', () => {
    const summary = {
      fk_column_id: 'hours',
      aggregation: 'utilization',
      utilization: {
        allocated_rate: 'week' as const,
        available_rate: 'week' as const,
        fk_resource_column_id: 'person',
        available_value: 40,
        time_off: {
          fk_model_id: 'off',
          fk_link_column_id: 'offLink',
          fk_start_column_id: 'offStart',
          fk_amount_column_id: 'offAmount',
          amount_unit: 'fraction' as const,
        },
      },
    };
    const ids: Record<string, string> = {
      hours: 'h2',
      person: 'p2',
      off: 'o2',
      offLink: 'ol2',
      offStart: 'os2',
      offAmount: 'oa2',
    };
    expect(
      remapDateAxisSummaryIds(summary, (id) => ids[id])?.utilization?.time_off
    ).toMatchObject({ fk_amount_column_id: 'oa2', amount_unit: 'fraction' });
    expect(
      remapDateAxisSummaryIds(summary, (id) =>
        id === 'offAmount' ? null : ids[id]
      )?.utilization?.time_off
    ).toBeNull();
  });

  it('reports unavailable resources as infinite', () => {
    expect(utilizationPercent({ allocated: 4, available: 0 })).toBe(Infinity);
    expect(formatUtilizationPercent(Infinity)).toBe('∞%');
    expect(formatUtilizationPercent(84.6)).toBe('85%');
  });

  it('picks the highest matching colour condition', () => {
    expect(utilizationColor(120)).toBe('red');
    expect(utilizationColor(80)).toBe('orange');
    expect(utilizationColor(10)).toBe('green');
    expect(utilizationColor(Infinity)).toBe('red');
    expect(utilizationColor(null)).toBeNull();
  });
  it('counts days off on working days only', () => {
    const res = computeUtilization({
      buckets: [week1],
      tasks: [
        {
          fromDay: week1.startDay,
          toDay: week1.endDay - 1,
          allocated: 8,
          resources: ['a'],
          available: 8,
        },
      ],
      timeOff: [
        { resource: 'a', fromDay: week1.startDay, toDay: week1.endDay - 1 },
      ],
      allocatedRate: 'day',
      availableRate: 'day',
      workingDays: MONDAY_TO_FRIDAY,
    });
    expect(res.groups[0].buckets[0].time_off).toBe(5);
  });

  it('keeps a total scheduled only on non-working days', () => {
    const res = computeUtilization({
      buckets: [week1],
      tasks: [
        {
          fromDay: day('2026-09-12'),
          toDay: day('2026-09-13'),
          allocated: 6,
          resources: ['a'],
          available: 40,
        },
      ],
      allocatedRate: 'total',
      availableRate: 'week',
      workingDays: MONDAY_TO_FRIDAY,
    });
    expect(res.groups[0].buckets[0]).toMatchObject({
      allocated: 6,
      available: 40,
    });
  });

  it('ignores bucket ends past the window', () => {
    const res = computeUtilization({
      buckets: [
        { startDay: week1.startDay, endDay: week1.startDay + 1_000_000 },
        week2,
      ],
      tasks: [],
      allocatedRate: 'total',
      availableRate: 'day',
    });
    expect(res.buckets).toHaveLength(2);
  });

  it('reads working hours from single values and lookup lists', () => {
    expect(toCapacity(8)).toBe(8);
    expect(toCapacity('7.5')).toBe(7.5);
    expect(toCapacity([6, 8])).toBe(8);
    expect(toCapacity('[4, "6"]')).toBe(6);
    expect(toCapacity([])).toBeNull();
    expect(toCapacity(null)).toBeNull();
    expect(toCapacity('')).toBeNull();
    expect(toCapacity('abc')).toBeNull();
  });
  it('classifies LTAR and Links fields of either version', () => {
    const link = (
      uidt: UITypes,
      type: RelationTypes,
      version?: number,
      meta?: Record<string, unknown>
    ): ColumnType => ({ uidt, meta, colOptions: { type, version } });

    for (const uidt of [UITypes.LinkToAnotherRecord, UITypes.Links]) {
      // V1 foreign key
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.BELONGS_TO))
      ).toBe(true);
      expect(
        isUtilizationTimeOffLink(link(uidt, RelationTypes.BELONGS_TO))
      ).toBe(true);
      expect(
        isUtilizationResourceLink(
          link(uidt, RelationTypes.ONE_TO_ONE, 1, { bt: true })
        )
      ).toBe(true);
      // V2 single-record links go through a junction
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.MANY_TO_ONE, 2))
      ).toBe(true);
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.ONE_TO_ONE, 2))
      ).toBe(true);
      expect(
        isUtilizationTimeOffLink(link(uidt, RelationTypes.MANY_TO_ONE, 2))
      ).toBe(true);
      // Several records per row
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.MANY_TO_MANY))
      ).toBe(false);
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.MANY_TO_MANY, 2))
      ).toBe(false);
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.ONE_TO_MANY, 2))
      ).toBe(false);
      expect(
        isUtilizationResourceLink(link(uidt, RelationTypes.HAS_MANY))
      ).toBe(false);
      expect(
        isUtilizationTimeOffLink(link(uidt, RelationTypes.MANY_TO_MANY))
      ).toBe(true);
      expect(isUtilizationTimeOffLink(link(uidt, RelationTypes.HAS_MANY))).toBe(
        false
      );
      // Resource-side counterparts of a time-off link
      expect(
        isUtilizationTimeOffSource(link(uidt, RelationTypes.HAS_MANY))
      ).toBe(true);
      expect(
        isUtilizationTimeOffSource(link(uidt, RelationTypes.ONE_TO_MANY, 2))
      ).toBe(true);
      expect(
        isUtilizationTimeOffSource(link(uidt, RelationTypes.MANY_TO_MANY))
      ).toBe(true);
      expect(
        isUtilizationTimeOffSource(link(uidt, RelationTypes.BELONGS_TO))
      ).toBe(false);
    }
    expect(isUtilizationResourceLink({ uidt: UITypes.User })).toBe(false);
    expect(isUtilizationResourceLink(null)).toBe(false);
  });

  it('treats a summary as complete only once utilization can compute', () => {
    const base = {
      aggregation: 'utilization',
      fk_column_id: 'hours',
      utilization: {
        allocated_rate: 'total' as const,
        available_rate: 'week' as const,
        fk_resource_column_id: 'owner',
        available_value: 40,
      },
    };
    expect(isUtilizationSummaryComplete(base)).toBe(true);
    expect(isUtilizationSummaryComplete({ ...base, fk_column_id: '' })).toBe(
      false
    );
    expect(
      isUtilizationSummaryComplete({
        ...base,
        utilization: { ...base.utilization, fk_resource_column_id: '' },
      })
    ).toBe(false);
    expect(
      isUtilizationSummaryComplete({
        ...base,
        utilization: { ...base.utilization, available_value: null },
      })
    ).toBe(false);
    expect(
      isUtilizationSummaryComplete({
        ...base,
        utilization: {
          ...base.utilization,
          available_value: null,
          fk_available_column_id: 'capacity',
        },
      })
    ).toBe(true);
    expect(
      isUtilizationSummaryComplete({
        ...base,
        utilization: {
          ...base.utilization,
          time_off: {
            fk_model_id: 'pto',
            fk_link_column_id: '',
            fk_start_column_id: '',
            fk_end_column_id: null,
            label: 'PTO',
          },
        },
      })
    ).toBe(false);
  });
  it('reads capacity off the resource ahead of task values', () => {
    const res = computeUtilization({
      buckets: [week1],
      tasks: [
        {
          fromDay: day('2026-09-07'),
          toDay: day('2026-09-11'),
          allocated: 20,
          resources: ['a', 'b'],
          available: 10,
        },
      ],
      allocatedRate: 'total',
      availableRate: 'week',
      workingDays: MONDAY_TO_FRIDAY,
      multipleResources: 'full',
      resourceCapacity: { a: 40 },
    });
    const byKey = Object.fromEntries(res.groups.map((g) => [g.key, g.total]));
    expect(byKey.a).toEqual({ allocated: 20, available: 40, time_off: 0 });
    // No override for b: the task's own value applies.
    expect(byKey.b).toEqual({ allocated: 20, available: 10, time_off: 0 });
  });

  it('needs dates, hours and working hours for a link preview', () => {
    const base = { allocated_rate: 'total', available_rate: 'week' } as const;
    expect(isLinkUtilizationPreviewComplete(base)).toBe(false);
    expect(
      isLinkUtilizationPreviewComplete({
        ...base,
        fk_from_column_id: 's',
        fk_hours_column_id: 'h',
      })
    ).toBe(false);
    expect(
      isLinkUtilizationPreviewComplete({
        ...base,
        fk_from_column_id: 's',
        fk_hours_column_id: 'h',
        available_value: 40,
      })
    ).toBe(true);
  });
  describe('partial time off', () => {
    // Mon–Fri at 8h/day, 8h of work every day of week 1.
    const busyWeek = {
      fromDay: week1.startDay,
      toDay: week1.endDay - 1,
      allocated: 8,
      resources: ['a'],
      available: 8,
    };
    const run = (
      timeOff: Parameters<typeof computeUtilization>[0]['timeOff'],
      timeOffUnit?: 'hours' | 'fraction'
    ) =>
      computeUtilization({
        buckets: [week1],
        tasks: [busyWeek],
        timeOff,
        timeOffUnit,
        allocatedRate: 'day',
        availableRate: 'day',
        workingDays: MONDAY_TO_FRIDAY,
      }).groups[0].buckets[0];

    it('treats an empty amount as the whole day, as before', () => {
      const off = { resource: 'a', fromDay: day('2026-09-08') };
      const before = run([off]);
      expect(before).toEqual({ allocated: 40, available: 32, time_off: 1 });
      expect(run([{ ...off, amount: null }], 'hours')).toEqual(before);
      expect(run([{ ...off, amount: null }], 'fraction')).toEqual(before);
    });

    it('takes hours off the day and keeps it out of the PTO count', () => {
      const cell = run(
        [{ resource: 'a', fromDay: day('2026-09-08'), amount: 3 }],
        'hours'
      );
      expect(cell).toEqual({ allocated: 40, available: 37, time_off: 0 });
    });

    it('takes a fraction of the day off', () => {
      const cell = run(
        [{ resource: 'a', fromDay: day('2026-09-08'), amount: 0.5 }],
        'fraction'
      );
      expect(cell).toEqual({ allocated: 40, available: 36, time_off: 0 });
    });

    it('adds overlapping records up to the whole day, which then counts as PTO', () => {
      const tue = day('2026-09-08');
      expect(
        run(
          [
            { resource: 'a', fromDay: tue, amount: 0.5 },
            { resource: 'a', fromDay: tue, amount: 0.25 },
          ],
          'fraction'
        )
      ).toEqual({ allocated: 40, available: 34, time_off: 0 });
      // 6h + 5h on an 8h day: capped at the day, never negative.
      expect(
        run(
          [
            { resource: 'a', fromDay: tue, amount: 6 },
            { resource: 'a', fromDay: tue, amount: 5 },
          ],
          'hours'
        )
      ).toEqual({ allocated: 40, available: 32, time_off: 1 });
      // A partial record on a day already off adds nothing.
      expect(
        run(
          [
            { resource: 'a', fromDay: tue },
            { resource: 'a', fromDay: tue, amount: 0.5 },
          ],
          'fraction'
        )
      ).toEqual({ allocated: 40, available: 32, time_off: 1 });
    });

    it('ignores a zero amount', () => {
      expect(
        run([{ resource: 'a', fromDay: day('2026-09-08'), amount: 0 }], 'hours')
      ).toEqual({ allocated: 40, available: 40, time_off: 0 });
    });

    it('applies a reduced-hours period on working days of every week it covers', () => {
      // Summer hours: 2h off a day across six weeks, of which two are shown.
      const withWork = computeUtilization({
        buckets: [week1, week2],
        tasks: [{ ...busyWeek, toDay: week2.endDay - 1 }],
        timeOff: [
          {
            resource: 'a',
            fromDay: day('2026-08-24'),
            toDay: day('2026-10-04'),
            amount: 2,
          },
          // A full day off inside the period wins over its 2h.
          { resource: 'a', fromDay: day('2026-09-16') },
        ],
        timeOffUnit: 'hours',
        allocatedRate: 'day',
        availableRate: 'week',
        workingDays: MONDAY_TO_FRIDAY,
        resourceCapacity: { a: 40 },
      });
      const [w1, w2] = withWork.groups[0].buckets;
      expect(w1).toMatchObject({ available: 30, time_off: 0 }); // 5 × (8 − 2)
      expect(w2).toMatchObject({ available: 24, time_off: 1 }); // 4 × 6, Wed off
      // Saturday and Sunday stay uncounted: allocation is 8h × 5 workdays.
      expect(w1.allocated).toBe(40);
    });

    it('stays linear with long partial records', () => {
      const buckets = Array.from({ length: 150 }, (_, i) => ({
        startDay: 20000 + i * 24,
        endDay: 20000 + (i + 1) * 24,
      }));
      const tasks = Array.from({ length: 200 }, (_, i) => ({
        fromDay: 20000,
        toDay: 23600,
        allocated: 1,
        resources: [`r${i}`],
        available: 8,
      }));
      const timeOff = Array.from({ length: 50_000 }, (_, i) => ({
        resource: `r${i % 200}`,
        fromDay: 20000 + (i % 3000),
        toDay: 20000 + (i % 3000) + 400,
        amount: 0.01,
      }));
      const started = Date.now();
      const res = computeUtilization({
        buckets,
        tasks,
        timeOff,
        timeOffUnit: 'fraction',
        allocatedRate: 'day',
        availableRate: 'day',
      });
      expect(res.groups).toHaveLength(200);
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });

  describe('ordering groups by utilization', () => {
    const totals = new Map([
      ['a', { allocated: 30, available: 40 }], // 75%
      ['b', { allocated: 50, available: 40 }], // 125%
      ['c', { allocated: 10, available: 40 }], // 25%
      ['d', { allocated: 5, available: 0 }], // ∞
      ['e', { allocated: 0, available: 0 }], // no value
    ]);
    const groups = [
      { name: 'Empty', keys: [] as string[] },
      { name: 'A', keys: ['a'] },
      { name: 'B', keys: ['b'] },
      { name: 'C', keys: ['c'] },
      { name: 'D', keys: ['d'] },
      { name: 'E', keys: ['e'] },
      { name: 'Idle', keys: ['z'] }, // no work in the window
    ];
    const percentOf = (g: (typeof groups)[number]) =>
      groupUtilizationPercent(g.keys, totals);
    const names = (setting) =>
      orderGroupsByUtilization(groups, percentOf, setting).map((g) => g.name);

    it('reads a group with no work as 0% and one with no person as nothing', () => {
      expect(percentOf(groups[6])).toBe(0);
      expect(percentOf(groups[0])).toBeNull();
      expect(percentOf(groups[5])).toBeNull();
      // Two people under one name: their hours add up.
      expect(groupUtilizationPercent(['a', 'c'], totals)).toBe(50);
    });

    it('sorts either way with groups lacking a value last', () => {
      expect(names({ sort: 'asc' })).toEqual([
        'Idle',
        'C',
        'A',
        'B',
        'D',
        'Empty',
        'E',
      ]);
      expect(names({ sort: 'desc' })).toEqual([
        'D',
        'B',
        'A',
        'C',
        'Idle',
        'Empty',
        'E',
      ]);
    });

    it('filters by a range and keeps the order otherwise', () => {
      expect(names({ gte: 75 })).toEqual(['A', 'B', 'D']);
      expect(names({ lte: 30, sort: 'desc' })).toEqual(['C', 'Idle']);
      expect(names({ gte: 20, lte: 100 })).toEqual(['A', 'C']);
      expect(names({ sort: null, gte: null })).toEqual(
        groups.map((g) => g.name)
      );
    });
  });
});
