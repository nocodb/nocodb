import {
  checksum_md5,
  checksum_sha1,
  checksum_sha256
} from "./functions";

describe("Checksum Formula Functions", () => {
  test("MD5 checksum", () => {
    expect(checksum_md5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  });

  test("SHA-1 checksum", () => {
    expect(checksum_sha1("hello")).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  });

  test("SHA-256 checksum", () => {
    expect(checksum_sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  test("Null or undefined returns null", () => {
    expect(checksum_md5(null)).toBeNull();
    expect(checksum_sha1(undefined)).toBeNull();
    expect(checksum_sha256(null)).toBeNull();
  });
});
