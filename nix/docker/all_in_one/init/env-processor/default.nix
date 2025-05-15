{
  writeShellApplication,
  coreutils,
  s6-portable-utils,
}:
writeShellApplication {
  name = "env-processor";

  runtimeInputs = [
    coreutils
    s6-portable-utils
  ];

  text = builtins.readFile ./env_processor.sh;
}
