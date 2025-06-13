import {
  appendToLength,
  AppendToLengthSuffix,
  truncateToLength,
} from './stringHelpers';

describe('stringHelpers', () => {
  describe('truncateToLength', () => {
    it('will truncate string to max length', async () => {
      const cases = [
        {
          value: '01234567890123456789',
          currentIndex: undefined,
          maxLength: 20,
          existing: [],
          expected: '01234567890123456...',
        },
        {
          value: '01234567890123456789',
          currentIndex: undefined,
          maxLength: 20,
          existing: ['01234567890123456...'],
          expected: '0123456789012345...2',
        },
        {
          value: '0123456789012345...9',
          currentIndex: 9,
          maxLength: 20,
          existing: ['0123456789012345...9'],
          expected: '012345678901234...10',
        },
      ];
      for (const eachCase of cases) {
        const isExists = async (needle: string) => {
          return eachCase.existing.includes(needle);
        };
        const result = await truncateToLength({
          value: eachCase.value,
          currentIndex: eachCase.currentIndex,
          maxLength: eachCase.maxLength,
          isExists,
        });
        expect(result).toBe(eachCase.expected);
      }
    });
    it('will truncate string to max length (_ suffix)', async () => {
      const cases = [
        {
          value: '01234567890123456789',
          currentIndex: undefined,
          maxLength: 20,
          existing: [],
          expected: '01234567890123456___',
        },
        {
          value: '01234567890123456789',
          currentIndex: undefined,
          maxLength: 20,
          existing: ['01234567890123456___'],
          expected: '0123456789012345___2',
        },
        {
          value: '0123456789012345___9',
          currentIndex: 9,
          maxLength: 20,
          existing: ['0123456789012345___9'],
          expected: '012345678901234___10',
        },
      ];
      for (const eachCase of cases) {
        const isExists = async (needle: string) => {
          return eachCase.existing.includes(needle);
        };
        const result = await truncateToLength({
          value: eachCase.value,
          currentIndex: eachCase.currentIndex,
          maxLength: eachCase.maxLength,
          suffix: AppendToLengthSuffix._,
          isExists,
        });
        expect(result).toBe(eachCase.expected);
      }
    });
  });
  describe('appendToLength', () => {
    it('will append without problem', async () => {
      const cases = [
        {
          value: 'abcdefghij',
          appendage: ' klmnopq',
          maxLength: 30,
          existing: [],
          expected: 'abcdefghij klmnopq',
        },
        {
          value: 'abcdefghij',
          appendage: ' klmnopq',
          maxLength: 30,
          existing: ['abcdefghij klmnopq'],
          expected: 'abcdefghij klmnopq_1',
        },
        {
          value: '012345678901234',
          appendage: ' copy',
          maxLength: 20,
          existing: [],
          expected: '012345678901234 copy',
        },
      ];
      for (const eachCase of cases) {
        const isExists = async (needle: string) => {
          return eachCase.existing.includes(needle);
        };
        const result = await appendToLength({
          value: eachCase.value,
          appendage: eachCase.appendage,
          maxLength: eachCase.maxLength,
          isExists,
        });
        expect(result).toBe(eachCase.expected);
      }
    });
    it('will append existing truncated', async () => {
      const cases = [
        {
          value: '012345678901234',
          appendage: ' copy',
          maxLength: 20,
          existing: ['012345678901234 copy'],
          expected: '012345678901234...',
        },
        {
          value: '012345678901234',
          appendage: ' copy',
          maxLength: 20,
          existing: ['012345678901234 copy', '012345678901234...'],
          expected: '012345678901234...2',
        },
      ];
      for (const eachCase of cases) {
        const isExists = async (needle: string) => {
          return eachCase.existing.includes(needle);
        };
        const result = await appendToLength({
          value: eachCase.value,
          appendage: eachCase.appendage,
          maxLength: eachCase.maxLength,
          isExists,
        });
        expect(result).toBe(eachCase.expected);
      }
    });
    it('will append existing truncated (_ suffix)', async () => {
      const cases = [
        {
          value: '012345678901234',
          appendage: ' copy',
          maxLength: 20,
          existing: ['012345678901234 copy'],
          expected: '012345678901234___',
        },
        {
          value: '012345678901234',
          appendage: ' copy',
          maxLength: 20,
          existing: ['012345678901234 copy', '012345678901234___'],
          expected: '012345678901234___2',
        },
      ];
      for (const eachCase of cases) {
        const isExists = async (needle: string) => {
          return eachCase.existing.includes(needle);
        };
        const result = await appendToLength({
          value: eachCase.value,
          appendage: eachCase.appendage,
          maxLength: eachCase.maxLength,
          isExists,
          suffix: AppendToLengthSuffix._,
        });
        expect(result).toBe(eachCase.expected);
      }
    });
  });
});
