# cd to gui
cd ./packages/nc-gui
# Allow node to use 8 GB of ram
export NODE_OPTIONS="--max-old-space-size=8192"
# Build and copy the gui to the right places
npm run build:copy
# install the new gui
npm i ../nc-lib-gui
# Make sure packages/nocodb/package.json has nc-lib-gui version set to "nc-lib-gui": "link:../nc-lib-gui"
cd ../../
pnpm bootstrap
sudo systemctl restart nocodb.service
