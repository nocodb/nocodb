import {
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

    // These three canonical zones have several legacy aliases. Recording only
    // the last one left them pointing at an alias Node does not accept, and
    // they fell back to Etc/UTC: ten hours out for Chuuk.
    it.each([
      ['Pacific/Chuuk', 'Pacific/Truk'],
      ['America/Indiana/Indianapolis', 'America/Indianapolis'],
      ['America/Argentina/Cordoba', 'America/Cordoba'],
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
