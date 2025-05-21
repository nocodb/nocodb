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
    # make sure /run is up
    if [ ! -e /run ]; then
      # shellcheck disable=SC2016
      echo 'use $docker run with `--tmpfs /run:nodev,nosuid,exec,mode=0755` flag'
      exit 1
    fi

    # setup basedir
    mkdir -p ${base_dir}
    cd ${base_dir}/
    cpio --extract -d < ${s6-linux-init}
    cd -

    # setup envs
    cp -r ${s6-services}/etc/s6-services  /run/s6-service-temp
    ${lib.getExe env-processor}

    # compile services
    s6-rc-compile ${srv_compile_dir} /run/s6-service-temp

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

    # stateful logs
    mkdir -p /var/log/

    # exec into s6-linux-init
    exec ${base_dir}/bin/init
  '';
}
