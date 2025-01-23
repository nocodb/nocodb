{
  pkgs,
  callPackage,
  fetchpatch2,
  openssl,
  python3,
  enableNpm ? true,
}:

let
  buildNodejs = callPackage "${pkgs.path}/pkgs/development/web/nodejs/nodejs.nix" {
    inherit openssl;
    python = python3;
  };
in
buildNodejs {
  inherit enableNpm;
  version = "22.12.0";
  sha256 = "/hvEvgBNwSch6iy2cbCKId4BxpdpYO+KEkh5hYlnnhY=";
  patches = [
    "${pkgs.path}/pkgs/development/web/nodejs/configure-emulator.patch"
    "${pkgs.path}/pkgs/development/web/nodejs/configure-armv6-vfpv2.patch"
    "${pkgs.path}/pkgs/development/web/nodejs/disable-darwin-v8-system-instrumentation-node19.patch"
    "${pkgs.path}/pkgs/development/web/nodejs/bypass-darwin-xcrun-node16.patch"
    "${pkgs.path}/pkgs/development/web/nodejs/node-npm-build-npm-package-logic.patch"
    "${pkgs.path}/pkgs/development/web/nodejs/use-correct-env-in-tests.patch"
    "${pkgs.path}/pkgs/development/web/nodejs/bin-sh-node-run-v22.patch"

    # fixes test failure, remove when included in release
    (fetchpatch2 {
      url = "https://github.com/nodejs/node/commit/b6fe731c55eb4cb9d14042a23e5002ed39b7c8b7.patch?full_index=1";
      hash = "sha256-KoKsQBFKUji0GeEPTR8ixBflCiHBhPqd2cPVPuKyua8=";
    })
  ];
}
