import { describe, it } from 'mocha';
import { expect } from 'chai';
import { program } from 'commander';

describe('Index', () => {

describe('index.ts', () => {
  it('should parse the arguments and options correctly', () => {
    const argv = ['node', 'index.ts', 'oldSecret', 'newSecret', '--nc-db','test_db_url', '--database-url', 'test_db_url', '-o', 'oldSecret', '-n', 'newSecret'];
    program.parse(argv);
    expect(program.opts().oldSecret).to.equal('oldSecret');
    expect(program.opts().newSecret).to.equal('newSecret');
    expect(program.opts().ncDb).to.equal('test_db_url');
    expect(program.opts().databaseUrl).to.equal('test_db_url');
  });
});
});
