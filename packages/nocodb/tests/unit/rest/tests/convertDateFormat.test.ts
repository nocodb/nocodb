import { expect } from 'chai';
import { convertDateFormat } from '../../../../src/helpers/convertDateFormat';

describe('convertDateFormat', () => {
  describe('allowlist validation', () => {
    it('should return correct format for known date formats (pg)', () => {
      expect(convertDateFormat('YYYY-MM-DD', 'pg')).to.equal('YYYY-MM-DD');
      expect(convertDateFormat('DD-MM-YYYY', 'pg')).to.equal('DD-MM-YYYY');
      expect(convertDateFormat('DD MMM YYYY', 'pg')).to.equal('DD MMM YYYY');
      expect(convertDateFormat('YYYY-MM', 'pg')).to.equal('YYYY-MM');
    });

    it('should return correct format for known date formats (mysql2)', () => {
      expect(convertDateFormat('YYYY-MM-DD', 'mysql2')).to.equal('%Y-%m-%d');
      expect(convertDateFormat('DD MMM YYYY', 'mysql2')).to.equal('%d %b %Y');
    });

    it('should return correct format for known date formats (sqlite3)', () => {
      expect(convertDateFormat('YYYY-MM-DD', 'sqlite3')).to.equal('%Y-%m-%d');
    });

    it('should return safe default for unrecognized format (pg)', () => {
      expect(convertDateFormat("YYYY') || (SELECT version()) || ('", 'pg')).to.equal('YYYY-MM-DD');
    });

    it('should return safe default for unrecognized format (mysql2)', () => {
      expect(convertDateFormat("' OR 1=1 --", 'mysql2')).to.equal('%Y-%m-%d');
    });

    it('should return safe default for unrecognized format (sqlite3)', () => {
      expect(convertDateFormat("'; DROP TABLE users; --", 'sqlite3')).to.equal('%Y-%m-%d');
    });

    it('should return safe default for empty string', () => {
      expect(convertDateFormat('', 'pg')).to.equal('YYYY-MM-DD');
    });

    it('should return safe default for unrecognized string value', () => {
      expect(convertDateFormat('undefined', 'pg')).to.equal('YYYY-MM-DD');
    });

    it('should return correct format for dateMonthFormats (pg)', () => {
      expect(convertDateFormat('YYYY-MM', 'pg')).to.equal('YYYY-MM');
      expect(convertDateFormat('YYYY MM', 'pg')).to.equal('YYYY MM');
    });
  });
});
