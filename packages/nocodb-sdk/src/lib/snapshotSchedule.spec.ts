import {
  buildSnapshotScheduleCron,
  isSnapshotScheduleTooFrequent,
  SnapshotScheduleFrequency,
} from './snapshotSchedule';
import type { SnapshotScheduleOccurrence } from './snapshotSchedule';

describe('buildSnapshotScheduleCron', () => {
  it('builds daily cron from time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {
        time: '02:00',
      })
    ).toBe('0 2 * * *');
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {
        time: '23:45',
      })
    ).toBe('45 23 * * *');
  });

  it('rejects invalid daily time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {
        time: '24:00',
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {})
    ).toBeNull();
  });

  it('builds weekly cron from day-of-week and time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.WEEKLY, {
        time: '02:00',
        dayOfWeek: 1,
      })
    ).toBe('0 2 * * 1');
  });

  it('rejects invalid day-of-week', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.WEEKLY, {
        time: '02:00',
        dayOfWeek: 7,
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.WEEKLY, {
        time: '02:00',
      })
    ).toBeNull();
  });

  it('builds monthly cron from day-of-month and time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.MONTHLY, {
        time: '02:00',
        dayOfMonth: 1,
      })
    ).toBe('0 2 1 * *');
  });

  it('rejects invalid day-of-month', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.MONTHLY, {
        time: '02:00',
        dayOfMonth: 0,
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.MONTHLY, {
        time: '02:00',
        dayOfMonth: 32,
      })
    ).toBeNull();
  });

  it('passes through valid 5-field custom cron', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {
        cron: '0 2 * * *',
      })
    ).toBe('0 2 * * *');
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {
        cron: '  0 2 * * 1  ',
      })
    ).toBe('0 2 * * 1');
  });

  it('rejects malformed custom cron', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {
        cron: '0 2 * *',
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {})
    ).toBeNull();
  });

  it('rejects unknown frequency', () => {
    // covers the removed `hourly` preset too — it can never satisfy the
    // once-per-day cap, so it was dropped from the enum.
    expect(buildSnapshotScheduleCron('yearly' as any, {})).toBeNull();
    expect(buildSnapshotScheduleCron('hourly' as any, {})).toBeNull();
  });
});

/**
 * Build an occurrence source from local wall-clock stamps (`YYYY-MM-DDTHH:mm`
 * in the schedule's own timezone). `epochMs` overrides the absolute instant so
 * DST artifacts can be modelled: the same wall clock at two different instants
 * (fall-back repeat), or one instant repeated (a stalled cron iterator).
 * Once the entries run out the last one repeats, which the scan reads as a
 * stalled source and stops on.
 */
function occurrenceSource(
  entries: { local: string; epochMs?: number }[]
): () => SnapshotScheduleOccurrence {
  let index = 0;

  return () => {
    const entry = entries[Math.min(index++, entries.length - 1)];
    const wallClock = new Date(`${entry.local}:00Z`);

    return {
      getTime: () => entry.epochMs ?? wallClock.getTime(),
      getFullYear: () => wallClock.getUTCFullYear(),
      getMonth: () => wallClock.getUTCMonth(),
      getDate: () => wallClock.getUTCDate(),
      getHours: () => wallClock.getUTCHours(),
      getMinutes: () => wallClock.getUTCMinutes(),
    };
  };
}

describe('isSnapshotScheduleTooFrequent', () => {
  it('accepts one occurrence per calendar day', () => {
    expect(
      isSnapshotScheduleTooFrequent(
        occurrenceSource([
          { local: '2026-01-01T02:00' },
          { local: '2026-01-02T02:00' },
          { local: '2026-01-03T02:00' },
        ])
      )
    ).toBe(false);
  });

  it('rejects two occurrences on the same calendar day', () => {
    // `0 0,23 * * 1` — 23h apart, which an interval floor with slack let by
    expect(
      isSnapshotScheduleTooFrequent(
        occurrenceSource([
          { local: '2026-01-05T00:00' },
          { local: '2026-01-05T23:00' },
          { local: '2026-01-12T00:00' },
        ])
      )
    ).toBe(true);
  });

  it('rejects a same-day pair that only appears later in the window', () => {
    // a first-two-occurrences check would accept this: the tight pair is third
    expect(
      isSnapshotScheduleTooFrequent(
        occurrenceSource([
          { local: '2026-01-01T02:30' },
          { local: '2026-01-02T02:00' },
          { local: '2026-01-02T02:30' },
        ])
      )
    ).toBe(true);
  });

  it('accepts the 23h gap left by a DST spring-forward displacement', () => {
    // America/New_York, `30 2 * * *`: 02:30 does not exist on 2026-03-08, so
    // the run is displaced to 03:30 and the next one lands 23h later.
    expect(
      isSnapshotScheduleTooFrequent(
        occurrenceSource([
          { local: '2026-03-07T02:30', epochMs: Date.UTC(2026, 2, 7, 7, 30) },
          { local: '2026-03-08T03:30', epochMs: Date.UTC(2026, 2, 8, 7, 30) },
          { local: '2026-03-09T02:30', epochMs: Date.UTC(2026, 2, 9, 6, 30) },
        ])
      )
    ).toBe(false);
  });

  it('accepts a DST fall-back repeat at the same wall-clock time', () => {
    // Antarctica/Troll, `0 2 * * *`: 02:00 runs twice on 2026-10-25 (2h apart)
    // because the zone drops back 2h — the schedule itself is still daily.
    expect(
      isSnapshotScheduleTooFrequent(
        occurrenceSource([
          { local: '2026-10-25T02:00', epochMs: Date.UTC(2026, 9, 25, 0, 0) },
          { local: '2026-10-25T02:00', epochMs: Date.UTC(2026, 9, 25, 2, 0) },
          { local: '2026-10-26T02:00', epochMs: Date.UTC(2026, 9, 26, 2, 0) },
        ])
      )
    ).toBe(false);
  });

  it('stops scanning when the source stops advancing', () => {
    // Australia/Lord_Howe, `0 2 * * *`: cron-parser returns one instant
    // forever across the DST-end transition. A 0ms gap is a parser stall, not
    // a schedule that fires twice.
    const stalled = Date.UTC(2026, 3, 4, 14, 0);

    expect(
      isSnapshotScheduleTooFrequent(
        occurrenceSource([
          { local: '2026-04-04T02:00', epochMs: Date.UTC(2026, 3, 3, 15, 0) },
          { local: '2026-04-05T01:00', epochMs: stalled },
          { local: '2026-04-05T01:00', epochMs: stalled },
        ])
      )
    ).toBe(false);
  });
});
