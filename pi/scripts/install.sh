#!/bin/bash
set -e

sudo apt update
sudo apt install -y git nodejs npm autossh

sudo mkdir -p /opt/gridbox/config
sudo chown -R pi:pi /opt/gridbox

cd /opt
git clone https://github.com/JOUW_ORG/gridbox-platform.git

cd gridbox-platform/pi/agent
npm install

sudo ln -s /opt/gridbox-platform/pi/systemd/gridbox-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gridbox-agent
sudo systemctl start gridbox-agent
