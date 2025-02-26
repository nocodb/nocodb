{
  lib,
  dockerTools,
  nocodb,
  postgresql,
  htop,
  s6,
  execline,
  coreutils,
  callPackage,
  s6-rc,
  s6-linux-init,
  util-linux,
  gnugrep,
  vim,
  minio,
  glibc,
  minica,
  gnused,
  nginx,
  nginxModules,
  lego,
  snooze,
  valkey,
}:
let
  nginxCustom = nginx.override {
    modules = lib.unique (nginx.modules ++ [ nginxModules.brotli ]);
  };

  init = callPackage ./init { };
  s6-services = callPackage ./init/s6-services { };

  pgconf = callPackage ./confs/postgres.nix { };
  nginxconf = callPackage ./confs/nginx.nix { };
  valkeyconf = callPackage ./confs/valkey.nix { };
in
dockerTools.buildLayeredImage {
  name = "nocodb_aio";

  contents = [
    dockerTools.binSh
    dockerTools.caCertificates

    nocodb
    postgresql
    snooze
    valkey
    execline.bin
    minio
    nginxCustom
    glibc.getent
    coreutils

    util-linux
    gnugrep
    gnused
    minica
    lego

    htop
    vim

    pgconf
    nginxconf
    valkeyconf
    s6-services

    s6
    s6-rc
    s6-linux-init
  ];

  config = {
    WorkingDir = "/var/lib";

    ExposedPorts = {
      # proxy bypass
      "8080/tcp" = { };
      # ssl redirect & acme-challenge
      "80/tcp" = { };
      # ssl
      "443/tcp" = { };
      # minio
      "9000/tcp" = { };
    };

    Entrypoint = [
      (lib.getExe init)
    ];
  };
}
