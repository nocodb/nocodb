{
  writeShellApplication,
  callPackage,
  coreutils,
  cpio,
  mount,
  shadow,
  dockerTools,
  lib,
}:
let
  base_dir = "/run/s6-init";
  srv_compile_dir = "/run/s6-service-compiled";

  s6-linux-init = callPackage ./s6-linux-init {
    inherit base_dir;
  };
  s6-services = callPackage ./s6-services { };
  env-processor = callPackage ./env-processor { };

  working_dir = "/usr/app/data";
  nocodb_run_dir = "/var/lib/nocodb";
  migrations_dir = "/var/lib/migrations";
  migrations_state = "${migrations_dir}/state";
in
writeShellApplication {
  name = "init";

  runtimeInputs = [
    cpio
    coreutils
    mount
    shadow

    s6-linux-init
  ];

  text = ''
    log() {
            echo init: "$@"
    }

    migrate_state_set() {
      mkdir -p ${migrations_dir}
      echo "$1" > ${migrations_state}
    }

    # warn if /run is not configured like normal s6 systems
    if [ ! -e /run ]; then
      # shellcheck disable=SC2016
      log 'please use docker run with `--tmpfs /run:nodev,nosuid,exec,mode=0755` flag'
      mkdir /run
    fi

    # backward compatiblity with legacy nocodb image
    ln -s ${working_dir} /var

    # setup basedir
    mkdir -p ${base_dir}
    cd ${base_dir}/
    cpio --extract -d < ${s6-linux-init}
    cd -

    # setup users & groups
    ${dockerTools.shadowSetup}
    for ident in s6log postgres nocodb minio valkey; do
      groupadd -r "$ident"
      useradd -r -g "$ident" "$ident"
    done
    # nginx
    groupadd -r nogroup
    useradd -r -g nogroup nobody

    # required for s6-envuidgid
    cat <<- EOF > /etc/nsswitch.conf
      passwd:    files
      group:     files
      shadow:    files
    EOF

    # container migrations (for future use)
    migrate_state_set 0

    # backward compatiblity with legacy nocodb image
    mkdir -p ${nocodb_run_dir}
    if [ -f ${working_dir}/noco.db ]; then
      touch ${migrations_dir}/from_legacy_image_with_sqlite
      mv ${working_dir}/noco.db ${nocodb_run_dir}
    fi
    if [ -d ${working_dir}/nc ]; then
      mv ${working_dir}/nc ${nocodb_run_dir}
    fi

    # setup envs
    cp -r ${s6-services}/etc/s6-services  /run/s6-service-temp
    ${lib.getExe env-processor}

    # compile services
    s6-rc-compile ${srv_compile_dir} /run/s6-service-temp

    # stateful logs
    mkdir -p /var/log/

    # exec into s6-linux-init
    exec ${base_dir}/bin/init
  '';
}
