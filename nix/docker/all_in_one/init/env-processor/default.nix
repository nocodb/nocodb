{
  writeShellApplication,
  coreutils,
}:
writeShellApplication {
  name = "env-processor";

  runtimeInputs = [ coreutils ];
  text = builtins.readFile ./env_processor.sh;
}
