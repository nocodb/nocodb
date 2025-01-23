{
  lib,
  dockerTools,
  callPackage,
}:
let
  nocodb = callPackage ./package.nix { };
in
dockerTools.buildLayeredImage {
  name = "nocodb";

  config = {
    Entrypoint = [
      (lib.getExe nocodb)
    ];
    ExposedPorts = {
      "8080/tcp" = { };
    };
  };
}
