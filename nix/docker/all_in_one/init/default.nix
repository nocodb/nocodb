{
  writeShellApplication,
  callPackage,
  coreutils,
  cpio,
  mount,
  shadow,
  dockerTools,
}:
let
  basedir = "/run/s6-init";
  srv_compile_dir = "/run/s6-service-compiled";

  s6-linux-init = callPackage ./s6-linux-init {
    inherit basedir;
  };
  s6-service-compiled = callPackage ./s6-services-compiled { };
in
writeShellApplication {
  name = "init";

  runtimeInputs = [
    cpio
    coreutils
    mount
    shadow

    s6-linux-init
    s6-service-compiled
  ];

  text = ''
    # setup /run
    mkdir -m 0000 /run
    mount -t tmpfs -o nodev,nosuid,mode=0755 none /run

    # setup basedir
    mkdir -p ${basedir}
    cd ${basedir}/
    cpio --extract -d < ${s6-linux-init}
    cd -

    # setup compiled services
    mkdir -p ${srv_compile_dir}
    cd ${srv_compile_dir}/
    cpio --extract -d < ${s6-service-compiled}/share/s6-service-compiled/archive.cpio
    cd -

    # setup users & groups
    ${dockerTools.shadowSetup}
    for ident in s6log postgres nocodb minio; do
      groupadd -r "$ident"
      useradd -r -g "$ident" "$ident"
    done

    # required for s6-envuidgid
    cat <<- EOF > /etc/nsswitch.conf
      passwd:    files
      group:     files
      shadow:    files
    EOF

    # stateful logs
    mkdir -p /var/log/

    # exec into s6-linux-init
    exec ${basedir}/bin/init
  '';
}
