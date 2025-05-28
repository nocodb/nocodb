{
  writeTextDir,
}:
writeTextDir "etc/redis.conf" ''
  # disable tcp
  port 0
  bind 127.0.0.1

  # enable unixsocket
  unixsocket /run/redis/redis.sock
  unixsocketperm 777
''
