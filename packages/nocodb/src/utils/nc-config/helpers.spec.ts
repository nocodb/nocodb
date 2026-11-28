import { jdbcToXcConfig, jdbcToXcUrl } from './helpers';

describe('database URL conversion', () => {
  it.each(['mysql://u:p@host:3306/db', 'jdbc:mysql://u:p@host:3306/db'])(
    'converts %s to a mysql2 config',
    (url) => {
      expect(jdbcToXcConfig(url)).toEqual({
        client: 'mysql2',
        connection: {
          user: 'u',
          password: 'p',
          host: 'host',
          port: '3306',
          database: 'db',
        },
      });
    },
  );

  it.each(['mysql://u:p@host:3306/db', 'jdbc:mysql://u:p@host:3306/db'])(
    'converts %s to an xc URL',
    (url) => {
      expect(jdbcToXcUrl(url)).toBe('mysql2://host:3306?u=u&p=p&d=db&');
    },
  );
});
