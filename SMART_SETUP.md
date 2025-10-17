# SMART Data Setup (Optional)

The system monitor will attempt to read SMART data from your disks for health monitoring.

## Requirements

Install smartmontools:
```bash
sudo apt install smartmontools    # Debian/Ubuntu
sudo dnf install smartmontools    # Fedora
sudo pacman -S smartmontools      # Arch
```

## Permissions

To read SMART data without sudo, you have two options:

### Option 1: Add sudoers rule (Recommended)
```bash
sudo visudo
```
Add this line (replace 'youruser' with your username):
```
youruser ALL=(ALL) NOPASSWD: /usr/sbin/smartctl
```

### Option 2: Run app with elevated permissions
```bash
sudo npm start
```

## What SMART Data Shows

When available, you'll see for each disk:
- Health status (✓ Healthy or ⚠️ Warning)
- Temperature
- Power-on hours (total uptime in days)
- SSD wear level (percentage)
- Reallocated/pending sectors (indicates failing drive)

The app will work fine without SMART data - it just won't show these extra health metrics.
