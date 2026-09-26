import {
  computeUtilization,
  countCountedDays,
  dateStringToDayNumber,
  dayNumberWeekday,
  formatUtilizationPercent,
  instantToDayNumber,
  MONDAY_TO_FRIDAY,
  remapDateAxisSummaryIds,
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
});
