#!/bin/bash

REG_TOKEN=$REG_TOKEN

# Create user named 'github-runner' and password as 'password'
adduser github-runner --disabled-password --gecos ""
usermod --password $(echo '.KsZG.v=SNrA#;j' | openssl passwd -1 -stdin) github-runner
sudo usermod -aG sudo github-runner

su - github-runner

# Install dependencies
sudo apt-get -y update
sudo apt-get -y install ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get -y update
sudo apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

#swap
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

sudo cp /etc/fstab /etc/fstab.bak
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Install ci container
sudo docker run   --detach   --env REG_TOKEN="${REG_TOKEN}"   --name runner   mustafapc19/ci