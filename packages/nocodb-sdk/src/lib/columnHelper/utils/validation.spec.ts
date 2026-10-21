import { getEmailHref, isValidPhoneNumber } from '.';

describe('isValidPhoneNumber', () => {
  it('accepts plain and spaced numbers', () => {
    expect(isValidPhoneNumber('+919845012345')).toBe(true);
    expect(isValidPhoneNumber('+91 98450 12345')).toBe(true);
    expect(isValidPhoneNumber('(415) 555-2671')).toBe(true);
    expect(isValidPhoneNumber(4155552671)).toBe(true);
  });

  it('rejects non-numbers', () => {
    expect(isValidPhoneNumber('')).toBe(false);
    expect(isValidPhoneNumber(null)).toBe(false);
    expect(isValidPhoneNumber(undefined)).toBe(false);
    expect(isValidPhoneNumber('call me')).toBe(false);
    expect(isValidPhoneNumber('12')).toBe(false);
  });
});

describe('getEmailHref', () => {
  it('keeps bare addresses unchanged', () => {
    expect(getEmailHref('person@example.com')).toBe(
      'mailto:person@example.com'
    );
  });

  it('puts named mailboxes in an encoded to header', () => {
    expect(getEmailHref('Jane Example <person@example.com>')).toBe(
      'mailto:?to=Jane%20Example%20%3Cperson%40example.com%3E'
    );
    expect(getEmailHref('Zoë Ñúñez <z@example.com>')).toBe(
      `mailto:?to=${encodeURIComponent('Zoë Ñúñez <z@example.com>')}`
    );
    expect(getEmailHref('<person@example.com>')).toBe(
      'mailto:person@example.com'
    );
  });

  it('quotes names with commas, quotes and reserved characters', () => {
    expect(getEmailHref('"Example, Jane" <person@example.com>')).toBe(
      `mailto:?to=${encodeURIComponent('"Example, Jane" <person@example.com>')}`
    );
    expect(getEmailHref('"Jane \\"JJ\\" Ex" <person@example.com>')).toBe(
      `mailto:?to=${encodeURIComponent(
        '"Jane \\"JJ\\" Ex" <person@example.com>'
      )}`
    );
    expect(getEmailHref('Jane (Ops) <person@example.com>')).toBe(
      `mailto:?to=${encodeURIComponent('"Jane (Ops)" <person@example.com>')}`
    );
  });

  it('rejects injection, multiple mailboxes and malformed values', () => {
    expect(getEmailHref('Jane <person@example.com>\r\nBcc: x@evil.com')).toBe(
      null
    );
    expect(getEmailHref('Jane <person@example.com?bcc=x@evil.com>')).toBe(null);
    expect(getEmailHref('A <a@example.com>, B <b@example.com>')).toBe(null);
    expect(getEmailHref('Example, Jane <person@example.com>')).toBe(null);
    expect(getEmailHref('Jane <not-an-email>')).toBe(null);
    expect(getEmailHref('Jane person@example.com')).toBe(null);
    expect(getEmailHref('<<person@example.com>>')).toBe(null);
    expect(getEmailHref('')).toBe(null);
    expect(getEmailHref(null)).toBe(null);
  });
});
