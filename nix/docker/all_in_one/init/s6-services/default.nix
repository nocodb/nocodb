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
    cp -r ${./services} $out/etc/s6-services
  '';
}
