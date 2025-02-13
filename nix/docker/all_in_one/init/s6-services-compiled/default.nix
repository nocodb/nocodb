{
  s6-rc,
  stdenv,
  cpio,
}:

stdenv.mkDerivation {
  name = "s6-linux-init";

  phases = [
    "installPhase"
    "fixupPhase"
  ];

  nativeBuildInputs = [
    s6-rc
    cpio
  ];

  installPhase = ''
    mkdir -p "$out/etc"
    cp -r ${./configs} "$out/etc/s6-confs"

    s6-rc-compile compiled ${./services}

    mkdir -p $out/share/s6-service-compiled
    cd compiled
    find . | cpio -Hnewc --create > $out/share/s6-service-compiled/archive.cpio
    cd -
  '';
}
