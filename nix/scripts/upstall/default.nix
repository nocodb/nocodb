{
  writeShellApplication,
  coreutils,
}:

writeShellApplication {
  name = "upstall";

  runtimeInputs = [
    coreutils
  ];

  text = builtins.readFile ./upstall.sh;
}
