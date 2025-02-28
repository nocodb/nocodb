{
  callPackage,
  lib,
}:
lib.attrsets.mapAttrs (key: _: callPackage ./${key} { }) (
  lib.attrsets.filterAttrs (key: _: key != "default.nix") (builtins.readDir ./.)
)
