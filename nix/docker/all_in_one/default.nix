{
  lib,
  dockerTools,
  callPackage,
  bash,
  coreutils,
}:
let
  nocodb = callPackage ../../package.nix { };
  port = 80;
in
dockerTools.buildLayeredImage {
  name = "nocodb_aio";

  contents = [
    dockerTools.binSh
    nocodb
    coreutils
  ];

  config = {
    WorkingDir = "/var/lib";

    Env = [
      "PORT=${builtins.toString port}"
    ];
    ExposedPorts = {
      "${builtins.toString port}/tcp" = { };
    };

    Entrypoint = [
      (lib.getExe bash)
    ];
  };
}
