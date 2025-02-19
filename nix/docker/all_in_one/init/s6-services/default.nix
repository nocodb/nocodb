{
  stdenv,
}:

stdenv.mkDerivation {
  name = "s6-services";

  phases = [
    "installPhase"
    "fixupPhase"
  ];

  installPhase = ''
    mkdir -p $out/etc
    cp -r ${./configs} $out/etc/s6-confs

    mkdir -p $out/share/s6
    cp -r ${./services} $out/share/s6/services
  '';
}
