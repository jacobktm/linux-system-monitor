# Linux System Monitor - Scripts Guide

This document explains how to use the setup and run scripts for the Linux System Monitor application.

## Quick Start

1. **Setup the application:**
   ```bash
   ./setup.sh
   ```

2. **Run the application:**
   ```bash
   ./run.sh
   ```

## Scripts Overview

### setup.sh
The setup script installs all dependencies and prepares your system for running the Linux System Monitor.

**What it does:**
- Detects your Linux distribution (supports Ubuntu, Pop!_OS, Fedora, RHEL, Arch, Manjaro)
- Installs Node.js and npm (if not present)
- Installs system dependencies (lm-sensors, smartmontools, etc.)
- Configures hardware sensors
- Checks GPU drivers
- Installs npm dependencies (Electron, systeminformation)
- Creates a desktop entry for easy access
- Verifies the installation

**Usage:**
```bash
./setup.sh
```

**Requirements:**
- Linux operating system
- Internet connection
- sudo privileges (for installing system packages)

### run.sh
The run script launches the Linux System Monitor with optimal settings and environment configuration.

**What it does:**
- Checks prerequisites and system requirements
- Sets optimal environment variables
- Prevents multiple instances from running
- Launches the application in production or development mode
- Handles cleanup on exit

**Usage:**
```bash
# Production mode (default)
./run.sh

# Development mode with DevTools
./run.sh --dev

# Check system requirements only
./run.sh --check

# Show help
./run.sh --help
```

**Options:**
- `-d, --dev`: Start in development mode with DevTools
- `-h, --help`: Show help message
- `-c, --check`: Only check prerequisites and system requirements
- `-v, --verbose`: Enable verbose output

## System Requirements

### Minimum Requirements
- Linux operating system
- Node.js 14 or higher
- 2GB RAM
- 100MB free disk space

### Recommended
- Modern Linux distribution (Ubuntu 20.04+, Pop!_OS 20.04+, Fedora 35+, Arch Linux)
- 4GB+ RAM
- Hardware sensors (lm-sensors)
- GPU drivers (NVIDIA/AMD) for GPU monitoring

### Optional Dependencies
- `lm-sensors` - For temperature and fan monitoring
- `smartmontools` - For disk health monitoring
- `nvidia-smi` - For NVIDIA GPU monitoring
- AMD GPU drivers - For AMD GPU monitoring

## Troubleshooting

### Setup Issues

**Permission denied:**
```bash
chmod +x setup.sh run.sh
```

**Node.js installation fails:**
- Check your internet connection
- Ensure you have sudo privileges
- Try installing Node.js manually from [nodejs.org](https://nodejs.org)

**System dependencies fail to install:**
- Update your package manager: `sudo apt update` (Ubuntu/Debian) or `sudo dnf update` (Fedora)
- Check if your distribution is supported
- Install dependencies manually

### Runtime Issues

**Application won't start:**
```bash
./run.sh --check
```
This will verify all prerequisites and show what's missing.

**Multiple instances:**
The run script automatically detects and prevents multiple instances. If you get a warning about another instance running, you can:
- Choose to terminate it when prompted
- Manually kill the process: `pkill -f electron`
- Remove the PID file: `rm /tmp/linux-system-monitor.pid`

**No sensor data:**
- Run `sudo sensors-detect` to configure hardware sensors
- Check if required kernel modules are loaded: `lsmod | grep coretemp`
- For disk temperatures, load the drivetemp module: `sudo modprobe drivetemp`

**GPU monitoring not working:**
- For NVIDIA: Install proprietary drivers and `nvidia-smi`
- For AMD: Ensure AMDGPU drivers are loaded
- Check if GPU is detected: `lspci | grep VGA`

### Performance Issues

**High CPU usage:**
- The application updates every 2 seconds by default
- You can modify the update interval in `renderer.js` (line 550)
- Close other resource-intensive applications

**Memory usage:**
- The application uses caching to reduce system calls
- Memory usage should stabilize after a few minutes
- Restart the application if memory usage becomes excessive

## Advanced Usage

### Custom Environment Variables
You can set custom environment variables before running:

```bash
# Disable GPU acceleration (if having issues)
export ELECTRON_DISABLE_GPU=1
./run.sh

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
./run.sh
```

### Running from Different Directory
If you need to run the scripts from a different directory:

```bash
# Absolute path
/home/system76/linux-system-monitor/run.sh

# Or create a symlink
ln -s /home/system76/linux-system-monitor/run.sh ~/bin/system-monitor
```

### Desktop Integration
The setup script creates a desktop entry. You can also:

- Pin to your taskbar/dock
- Add to your application menu
- Create a keyboard shortcut

## Uninstallation

To remove the Linux System Monitor:

1. **Remove the application directory:**
   ```bash
   rm -rf /home/system76/linux-system-monitor
   ```

2. **Remove desktop entry:**
   ```bash
   rm ~/.local/share/applications/linux-system-monitor.desktop
   ```

3. **Remove system dependencies (optional):**
   ```bash
   # Ubuntu/Debian
   sudo apt remove lm-sensors smartmontools
   
   # Fedora
   sudo dnf remove lm_sensors smartmontools
   
   # Arch
   sudo pacman -R lm_sensors smartmontools
   ```

## Support

If you encounter issues:

1. Check this README for common solutions
2. Run `./run.sh --check` to verify your system
3. Check the main README.md for detailed troubleshooting
4. Ensure your system meets the minimum requirements

## License

These scripts are part of the Linux System Monitor project and are released under the MIT License.
