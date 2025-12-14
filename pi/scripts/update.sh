#!/bin/bash
cd /opt/gridbox-platform
git pull origin main
cd pi/agent
npm install
sudo systemctl restart gridbox-agent
