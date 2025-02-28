{
  writeShellApplication,
  gnugrep,
  gnused,
  git,
  nix,
}:
writeShellApplication {
  name = "bumper";

  runtimeInputs = [
    gnugrep
    gnused
    git
    nix
  ];

  text = builtins.readFile ./bumper.sh;
}
