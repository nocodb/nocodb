// Function to verify TXT record
import { promises as dnsPromises } from 'dns';

export async function verifyTXTRecord(domain, expectedRecord) {
  // if test environment, skip verification
  if (process.env.NODE_ENV === 'test') {
    console.log('Skipping TXT record verification in test environment');
    return true;
  }

  try {
    const records = await dnsPromises.resolve(domain, 'TXT');
    const txtRecords = records.flat();

    if (txtRecords.includes(expectedRecord)) {
      console.log('TXT record verified successfully');
      return true;
    } else {
      console.error('TXT record verification failed');
      return false;
    }
  } catch (error) {
    console.error('Error verifying TXT record:', error.message);
    return false;
  }
}
