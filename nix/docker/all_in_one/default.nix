{
  lib,
  dockerTools,
  nocodb,
  coreutils,
  callPackage,
  s6-rc,
  s6-linux-init,
  util-linux,
}:
let
  port = 80;

  init = callPackage ./init { };
  pgconf = callPackage ./pgconf.nix { };
in
dockerTools.buildLayeredImage {
  name = "nocodb_aio";

  contents = [
    dockerTools.binSh
    nocodb
    coreutils
    util-linux

    pgconf
    s6-rc
    s6-linux-init
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
      (lib.getExe init)
    ];
  };
}
