# Run server if its not running
if ! curl --output /dev/null --silent --head --fail http://localhost:3010
then
  echo "Starting PlayWright Server"
  npx playwright run-server --reuse-browser --port 3010 &

  # Wait for server to start
  while ! curl --output /dev/null --silent --head --fail http://localhost:3010; do
    sleep 0.2
  done
fi