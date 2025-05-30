{
  writeShellApplication,
  coreutils,
}:

writeShellApplication {
  name = "migrator";

  runtimeInputs = [
    coreutils
  ];

  text = builtins.readFile ./migrator.sh;
}
