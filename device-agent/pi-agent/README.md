\# Gridbox Pi Agent



\## Bestanden

\- agent.mjs

\- take-picture.mjs

\- gridbox-agent.service

\- config.example.json (veilig)

\- config.json (lokaal, niet committen)

\- install.sh / update.sh / export.sh



\## Install op Pi

```bash

cd ~

sudo apt-get update

sudo apt-get install -y git

git clone https://github.com/dijkmans/gridbox-platform.git

cd gridbox-platform/device-agent/pi-agent

chmod +x install.sh update.sh export.sh

./install.sh

sudo nano /opt/gridbox-agent/config.json

sudo systemctl restart gridbox-agent



