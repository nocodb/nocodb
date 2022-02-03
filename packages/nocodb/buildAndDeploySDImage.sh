#/bin/sh
# NOT TESTED but the commands are right....
set -e

cd ../nc-gui
npm run build:copy

cd ../nocodb

npm run prepare:local
npm run build
npm run docker:build
npm run docker:image:build

docker tag nocodb/nocodb:latest sdbacontainerregistry.azurecr.io/watchdog-noco:latest

az login
az acr login --name sdbacontainerregistry

docker  push sdbacontainerregistry.azurecr.io/watchdog-noco:latest