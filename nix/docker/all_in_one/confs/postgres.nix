{
  lib,
  writeTextDir,
  writeText,
}:
let
  toStr =
    value:
    if true == value then
      "yes"
    else if false == value then
      "no"
    else if lib.isString value then
      "'${lib.replaceStrings [ "'" ] [ "''" ] value}'"
    else
      builtins.toString value;

  hba = writeText "pg_hba.conf" ''
    #type database DBuser  origin-address auth-method
    # unix socket
    local all      all                    trust
    # ipv4
    host  all      all     127.0.0.1/32   trust
    # ipv6
    host  all      all     ::1/128        trust
  '';

  empty_file = writeText "empty" "";
in
writeTextDir "etc/postgresql/postgresql.conf" (
  lib.concatStringsSep "\n" (
    lib.mapAttrsToList (n: v: "${n} = ${toStr v}") (
      lib.filterAttrs (lib.const (x: x != null)) {
        hba_file = builtins.toString hba;
        ident_file = builtins.toString empty_file;
        jit = "off";
        listen_addresses = "localhost";
        log_destination = "stderr";
        log_line_prefix = "[%p] ";
        port = 5432;
      }
    )
  )
)
