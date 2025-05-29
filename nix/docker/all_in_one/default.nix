{
  lib,
  dockerTools,
  nocodb,
  postgresql_16,
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
  redis,
  glibcLocales,
}:
let
  nginxCustom = nginx.override {
    modules = lib.unique (nginx.modules ++ [ nginxModules.brotli ]);
  };

  init = callPackage ./init { };
  s6-services = callPackage ./init/s6-services { };

  pgconf = callPackage ./confs/postgres.nix { };
  nginxconf = callPackage ./confs/nginx.nix { };
  redisconf = callPackage ./confs/redis.nix { };
in
dockerTools.buildLayeredImage {
  name = "nocodb";

  contents = [
    dockerTools.binSh
    dockerTools.caCertificates

    nocodb
    postgresql_16
    snooze
    redis
    execline.bin
    minio
    nginxCustom
    glibc.bin
    coreutils
    glibcLocales

    util-linux
    gnugrep
    gnused
    minica
    lego

    htop
    vim

    pgconf
    nginxconf
    redisconf
    s6-services

    s6
    s6-rc
    s6-linux-init
  ];

  config = {
    WorkingDir = "/usr/app/data";

    ExposedPorts = {
      # http & acme-challenge
      "8080/tcp" = { };
      # https redirect & acme-challenge
      "80/tcp" = { };
      # https
      "443/tcp" = { };
      # minio
      "9000/tcp" = { };
    };

    Entrypoint = [
      (lib.getExe init)
    ];
  };
}
