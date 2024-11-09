#!/bin/bash

sudo dnf install -y git

sudo dnf install -y wget
wget https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh
bash install.sh

source ~/.bashrc
nvm install v21.5.0

npm install -g npm@10.5.2
node -v && npm -v

sudo yum install -y gtk3
sudo dnf install -y libdrm libgbm alsa-lib

npm install puppeteer@21.5.2 && npm install commander@11.1.0 && npm install xmlhttprequest@1.8.0

sudo dnf install -y zip
