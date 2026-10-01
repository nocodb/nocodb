import {
  computeUtilization,
  countCountedDays,
  dateStringToDayNumber,
  dayNumberWeekday,
  formatUtilizationPercent,
  instantToDayNumber,
  utilizationColor,
  utilizationPercent,
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
    expect(countCountedDays(week1.startDay, week1.endDay - 1, true)).toBe(5);
    expect(countCountedDays(day('2026-09-11'), day('2026-09-15'), true)).toBe(
      3,
    );
    expect(countCountedDays(day('2026-09-11'), day('2026-09-15'))).toBe(5);
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
      workdaysOnly: true,
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
      workdaysOnly: true,
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
      workdaysOnly: true,
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
