{ stdenv }:
stdenv.mkDerivation {
  name = "skel";
  src = ./.;
  phases = [ "unpackPhase" "installPhase" "fixupPhase" ];

  installPhase = ''
    mkdir -p $out/etc/s6-linux-init/skel/

    cp $src/rc.init $out/etc/s6-linux-init/skel/
    cp $src/rc.shutdown $out/etc/s6-linux-init/skel/
    cp $src/rc.shutdown.final $out/etc/s6-linux-init/skel/
    cp $src/runlevel $out/etc/s6-linux-init/skel/
  '';
}
