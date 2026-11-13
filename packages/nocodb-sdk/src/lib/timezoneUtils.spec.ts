import {
  getCanonicalTimezone,
  getNodejsTimezone,
  isDateTimeStringHasTimezone,
  nodejsTimezones,
  timezoneAliases,
} from './timezoneUtils';

describe('timezoneUtils', () => {
  describe('getNodejsTimezone', () => {
    it('will get Asia/Kolkata', () => {
      expect(getNodejsTimezone('Asia/Kolkata', 'Asia/Jakarta')).toBe(
        'Asia/Calcutta'
      );
    });

    // Canonical zones Node only carries under an alias. The first three have
    // several aliases; recording only the last one fell back to Etc/UTC.
    it.each([
      ['Pacific/Chuuk', 'Pacific/Truk'],
      ['America/Indiana/Indianapolis', 'America/Indianapolis'],
      ['America/Argentina/Cordoba', 'America/Cordoba'],
      // browsers send the current name; Node only carries the alias
      ['Europe/Kyiv', 'Europe/Kiev'],
      ['Asia/Yangon', 'Asia/Rangoon'],
      ['America/Nuuk', 'America/Godthab'],
    ])('resolves %s to an alias node accepts', (canonical, expected) => {
      expect(getNodejsTimezone(canonical)).toBe(expected);
    });

    it('never answers with a zone node does not accept', () => {
      const unusable = Object.keys(timezoneAliases).filter((zone) => {
        const resolved = getNodejsTimezone(zone);
        return resolved !== 'Etc/UTC' && !nodejsTimezones.has(resolved);
      });
      expect(unusable).toEqual([]);
    });

    it('gives up only when no name for the zone is one node carries', () => {
      // Group every alias with its canonical name, then require that a zone
      // resolves whenever any name in its group is one Node accepts.
      const groups: Record<string, Set<string>> = {};
      for (const [alias, canonical] of Object.entries(timezoneAliases)) {
        const key = timezoneAliases[canonical] ? canonical : alias;
        (groups[key] ??= new Set()).add(alias);
        groups[key].add(canonical);
      }
      const givenUp: string[] = [];
      for (const names of Object.values(groups)) {
        if (![...names].some((name) => nodejsTimezones.has(name))) continue;
        for (const name of names) {
          if (name !== 'Etc/UTC' && getNodejsTimezone(name) === 'Etc/UTC') {
            givenUp.push(name);
          }
        }
      }
      expect(givenUp).toEqual([]);
    });
  });

  describe('getCanonicalTimezone', () => {
    // Aliases ICU reports on macOS; Postgres with Debian tzdata rejects them.
    it.each([
      ['Asia/Calcutta', 'Asia/Kolkata'],
      ['Asia/Saigon', 'Asia/Ho_Chi_Minh'],
      ['Asia/Katmandu', 'Asia/Kathmandu'],
      ['Asia/Rangoon', 'Asia/Yangon'],
      ['Europe/Kiev', 'Europe/Kyiv'],
      ['America/Godthab', 'America/Nuuk'],
    ])('maps %s to %s', (alias, canonical) => {
      expect(getCanonicalTimezone(alias)).toBe(canonical);
    });

    it('keeps current names, including ones the reverse map points away', () => {
      expect(getCanonicalTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
      expect(getCanonicalTimezone('Europe/Berlin')).toBe('Europe/Berlin');
    });

    // A rename must not shift any time the SQL renders.
    it('never maps a zone to one with a different offset', () => {
      const instants = [
        '2009-01-15T00:00Z',
        '2009-07-15T00:00Z',
        '2026-01-15T00:00Z',
        '2026-07-01T00:00Z',
      ];
      const offset = (timeZone: string, iso: string) =>
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          timeZoneName: 'longOffset',
        }).format(new Date(iso));
      const mapped = Object.keys(timezoneAliases).filter(
        (zone) => getCanonicalTimezone(zone) !== zone
      );
      expect(mapped.length).toBeGreaterThan(100);
      const shifted = mapped.flatMap((zone) =>
        instants
          .filter(
            (iso) =>
              offset(zone, iso) !== offset(getCanonicalTimezone(zone), iso)
          )
          .map((iso) => `${zone} -> ${getCanonicalTimezone(zone)} @ ${iso}`)
      );
      expect(shifted).toEqual([]);
    });
  });

  describe('isDateTimeStringHasTimezone', () => {
    it('will evaluate some test cases', () => {
      // Test cases with expected values
      const testCases = [
        { value: '2024-10-14T10:30:00Z', expected: true },
        { value: '2024-10-14T10:30:00+05:30', expected: true },
        { value: '2024-10-14T10:30:00+0530', expected: true },
        { value: '2024-10-14T10:30:00-08:00', expected: true },
        { value: '2024-10-14 10:30:00 EST', expected: true },
        { value: '2024-10-14 10:30:00 GMT', expected: true },
        { value: 'Mon Oct 14 2024 10:30:00 GMT+0530', expected: true },
        { value: '2024-10-14 10:30:00 (PST)', expected: true },
        { value: '2024-10-14 10:30:00', expected: false },
        { value: '2024-10-14T10:30:00', expected: false },
        { value: '10/14/2024 10:30 AM', expected: false },
        { value: 'Mon Oct 14 10:30:00 2024', expected: false },
      ];
      const failed: string[] = [];

      testCases.forEach(({ value, expected }) => {
        const result = isDateTimeStringHasTimezone(value);

        if (result !== expected) {
          failed.push(`${value} is expected ${expected} but found ${result}`);
        }
      });

      if (failed.length) {
        console.log(failed);
      }
      expect(failed.length).toBe(0);
    });
  });
});
