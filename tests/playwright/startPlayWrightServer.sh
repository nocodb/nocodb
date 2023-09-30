# Run server if its not running
if ! curl --output /dev/null --silent --head --fail http://localhost:31000
then
  echo "Starting PlayWright Server"
  PWDEBUG=console pnpm exec playwright run-server --port 31000 &

  # Wait for server to start
  while ! curl --output /dev/null --silent --head --fail http://localhost:31000; do
    sleep 0.2
  done
fi
