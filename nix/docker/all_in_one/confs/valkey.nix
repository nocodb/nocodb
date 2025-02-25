{
  writeTextDir,
}:
writeTextDir "etc/valkey.conf" ''
        # disable tcp
        port 0
        bind 127.0.0.1

        # enable unixsocket
        unixsocket /run/valkey/valkey.sock
        unixsocketperm 777
''
