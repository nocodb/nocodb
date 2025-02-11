{
  writeShellApplication,
  callPackage,
  coreutils,
  cpio,
  mount,
}:
let
  s6-linux-init = callPackage ./s6-linux-init { };
  basedir = "/run/init";
in
writeShellApplication {
  name = "init";

  runtimeInputs = [
    cpio
    coreutils
    mount
  ];

  text = ''
    mkdir -m 0000 -p /run
    mount -t tmpfs -o nodev,nosuid,mode=0755 none /run

    mkdir -p ${basedir}
    cd ${basedir}/
    cpio --extract -d < ${s6-linux-init}
    cd -

    exec ${basedir}/bin/init
  '';
}
