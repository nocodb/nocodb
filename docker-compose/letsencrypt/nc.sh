#!/usr/bin/env bash


read -p "Enter your domain name: " domain
read -p "Enter your email id: " email

# Docker installation
if [ -x "$(command -v docker)" ]; then
  echo "Docker already available"
else
  sudo apt-get update
  sudo apt-get install -y apt-transport-https ca-certificates curl gnupg2 software-properties-common
  curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add --
  sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/debian buster stable"
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io
  sudo usermod -a -G docker $USER
  echo "Docker installed successfully"
fi

# Docker compose installation
if [ -x "$(command -v docker-compose)" ]; then
  echo "Docker-compose already available"
else
  sudo apt-get -y install wget
  sudo wget https://github.com/docker/compose/releases/download/1.26.2/docker-compose-$(uname -s)-$(uname -m) -O /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  docker-compose --version
  echo "Docker-compose installed successfully"
fi


#wget https://github.com/evertramos/docker-compose-letsencrypt-nginx-proxy-companion/archive/master.zip -O master.zip
#
#unzip -n master.zip
#
#cd docker-compose-letsencrypt-nginx-proxy-companion-master

git clone https://github.com/evertramos/docker-compose-letsencrypt-nginx-proxy-companion.git

cd docker-compose-letsencrypt-nginx-proxy-companion

OUTPUT1=$(./start.sh)




docker run -p 8080:8080 -p 8081:8081 -p 8082:8082 -d --name xc-instant  \
-e VIRTUAL_HOST="$domain" \
-e LETSENCRYPT_HOST="$domain" \
-e LETSENCRYPT_EMAIL="$email" \
-e VIRTUAL_PORT=8080 \
--network=webproxy nocodb/nocodb:latest







