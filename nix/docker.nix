{
  lib,
  dockerTools,
  callPackage,
}:
let
  nocodb = callPackage ./package.nix { };
in
dockerTools.buildImage {
  name = "nocodb";
  config = {
    Cmd = [
      (lib.getExe nocodb)
    ];
  };
}
