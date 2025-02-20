{
  stdenv,
  # The first thing s6-linux-init does is to mount /run and recursively copy its
  # template into /run/s6-linux-init.  Unfortunately the "template" contains
  # setgid directories and named pipes, which means it can't be kept in the nix
  # store.  In order to put it there, we wrap it in a cpio archive;
  # unfortunately this means that we must run our own /run-mounting and
  # cpio-unpacking script ahead of s6-linux-init's `init`.  The mount options
  # for /run are the same as those found in s6-linux-init.c.
  cpio,
  # needed because s6-linux-init-maker expects to be able to create setgid
  # directories, which the Nix sandbox forbids
  fakeroot,
  s6-linux-init,
  base_dir ? "/run/init",
}:

stdenv.mkDerivation {
  name = "s6-linux-init";

  phases = [
    "installPhase"
    "fixupPhase"
  ];

  nativeBuildInputs = [
    s6-linux-init
    fakeroot
    cpio
  ];

  installPhase = ''
    # patchShebangs skel
    fakeroot s6-linux-init-maker \
      -C -N -1 \
      -f ${./skel} \
      -c ${base_dir} \
      compiled

    cd compiled
    find . | cpio -Hnewc --create > $out
    cd -
  '';
}
