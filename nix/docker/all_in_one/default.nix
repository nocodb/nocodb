{
  lib,
  dockerTools,
  nocodb,
  htop,
  s6,
  execline,
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
  s6-services-compiled = callPackage ./init/s6-services-compiled { };
in
dockerTools.buildLayeredImage {
  name = "nocodb_aio";

  contents = [
    dockerTools.binSh
    nocodb
    execline.bin
    coreutils
    util-linux

    htop

    pgconf
    s6-services-compiled

    s6
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
