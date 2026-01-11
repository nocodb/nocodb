import { Logger } from '@nestjs/common';
import { validatePassword } from 'nocodb-sdk';
import boxen from 'boxen';
import { NcDebug } from 'nc-gui/utils/debug';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { randomTokenString } from '~/services/users/helpers';

const logger = new Logger('initBasicAuth');

/**
 * Generates cryptographically secure random credentials
 */
function generateSecureCredentials(): { username: string; password: string } {
  // Use randomTokenString() which generates 80-character hex strings (320 bits entropy)
  // This provides sufficient security for HTTP Basic Auth credentials
  const username = randomTokenString();
  const password = randomTokenString();

  return { username, password };
}

/**
 * Validates if credentials are weak or use default values
 */
function isWeakCredentials(
  username: string,
  password: string,
): {
  isWeak: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let isWeak = false;

  // Check for hardcoded defaults from old configuration
  if (username === 'defaultusername') {
    reasons.push('Username is using default value');
    isWeak = true;
  }
  if (password === 'defaultpassword') {
    reasons.push('Password is using default value');
    isWeak = true;
  }

  // Check password strength using nocodb-sdk validation
  const { valid, error } = validatePassword(password);
  if (!valid) {
    reasons.push(`Weak password: ${error}`);
    isWeak = true;
  }

  // Check for common weak usernames
  const commonWeak = ['admin', 'user', 'test', 'root', 'administrator'];
  if (commonWeak.includes(username.toLowerCase())) {
    reasons.push('Username is commonly used and easily guessable');
    isWeak = true;
  }

  return { isWeak, reasons };
}

/**
 * Initialize BasicAuth credentials with secure defaults
 * Follows the same pattern as initJwt in Noco.ts
 *
 * Priority order:
 * 1. Environment variables (NC_HTTP_BASIC_USER, NC_HTTP_BASIC_PASS)
 * 2. Database stored credentials
 * 3. Auto-generated secure credentials
 *
 * @param _ncMeta - MetaService instance for database operations
 * @returns Object containing username, password, and source
 */
export default async function initBasicAuth(_ncMeta = Noco.ncMeta) {
  try {
    let username: string;
    let password: string;
    let source = 'generated';

    // Priority 1: Check environment variables (backward compatibility)
    if (process.env.NC_HTTP_BASIC_USER && process.env.NC_HTTP_BASIC_PASS) {
      username = process.env.NC_HTTP_BASIC_USER;
      password = process.env.NC_HTTP_BASIC_PASS;
      source = 'environment';

      // Validate environment-provided credentials
      const { isWeak, reasons } = isWeakCredentials(username, password);
      if (isWeak) {
        console.warn(
          '\n',
          boxen(
            [
              'SECURITY WARNING: Weak HTTP Basic Auth credentials detected!',
              '',
              'Issues found:',
              ...reasons.map((r) => `  • ${r}`),
              '',
              'Recommendation: Use strong, randomly generated credentials or remove',
              'NC_HTTP_BASIC_USER and NC_HTTP_BASIC_PASS to auto-generate secure credentials.',
            ].join('\n'),
            {
              title: '⚠️  HTTP Basic Auth Security Warning',
              padding: 1,
              borderStyle: 'double',
              titleAlignment: 'center',
              borderColor: 'yellow',
            },
          ),
          '\n',
        );
      }

      NcDebug.log(
        'HTTP Basic Auth credentials loaded from environment variables',
      );
    } else {
      // Priority 2: Check database for stored credentials
      const storedUsername = await _ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        { key: 'nc_http_basic_username' },
      );

      const storedPassword = await _ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        { key: 'nc_http_basic_password' },
      );

      if (storedUsername?.value && storedPassword?.value) {
        username = storedUsername.value;
        password = storedPassword.value;
        source = 'database';
        NcDebug.log('HTTP Basic Auth credentials loaded from database');
      } else {
        // Priority 3: Generate new secure credentials
        const generated = generateSecureCredentials();
        username = generated.username;
        password = generated.password;

        // Store in database for persistence across restarts
        await _ncMeta.metaInsert2(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.STORE,
          {
            key: 'nc_http_basic_username',
            value: username,
          },
          true,
        );

        await _ncMeta.metaInsert2(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.STORE,
          {
            key: 'nc_http_basic_password',
            value: password,
          },
          true,
        );

        logger.log(
          '\n' +
            boxen(
              [
                'HTTP Basic Auth credentials have been auto-generated.',
                '',
                `Username: ${username}`,
                `Password: ${password}`,
                '',
                'IMPORTANT: Save these credentials securely!',
                'These credentials are stored in the database and will persist.',
                '',
                'To customize, set environment variables:',
                '  NC_HTTP_BASIC_USER=your_username',
                '  NC_HTTP_BASIC_PASS=your_password',
              ].join('\n'),
              {
                title: '🔐 HTTP Basic Auth Credentials Generated',
                padding: 1,
                borderStyle: 'round',
                borderColor: 'green',
              },
            ),
        );

        NcDebug.log(
          'HTTP Basic Auth credentials auto-generated and stored in database',
        );
      }
    }

    // Update the application config with initialized credentials
    if (Noco.config) {
      Noco.config.basicAuth = {
        username,
        password,
      };
    }

    return { username, password, source };
  } catch (error) {
    logger.error('Failed to initialize HTTP Basic Auth credentials', error);
    throw error;
  }
}
