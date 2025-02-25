{
  lib,
  dockerTools,
  callPackage,
}:
let
  nocodb = callPackage ./package.nix { };
  port = 80;
in
dockerTools.buildLayeredImage {
  name = "nocodb";
  contents = [ dockerTools.binSh ];

  config = {
    Env = [
      "PORT=${builtins.toString port}"
    ];
    ExposedPorts = {
      "${builtins.toString port}/tcp" = { };
    };
    Entrypoint = [
      (lib.getExe nocodb)
    ];
  };
}
