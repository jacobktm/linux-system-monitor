# Linux System Monitor

A comprehensive system resource monitoring application built with Electron for Linux. Track CPU, memory, GPU, disk I/O, battery, fans, power consumption, network, and much more in real-time with a beautiful, modern interface.

## Features

### 📊 Comprehensive Monitoring

- **CPU Monitoring**
  - Real-time CPU usage (overall and per-core)
  - CPU frequencies for each core
  - CPU temperatures from multiple sensors
  - CPU brand, cores, and specifications

- **Memory Monitoring**
  - RAM usage and availability
  - Swap usage
  - Real-time memory statistics

- **GPU Monitoring**
  - GPU utilization and VRAM usage
  - GPU temperature monitoring
  - Fan speed (if available)
  - Power draw and limits
  - Core and memory clock speeds
  - Support for multiple GPUs

- **Disk Monitoring**
  - Real-time read/write I/O rates
  - Storage device information
  - Disk temperatures (NVMe and SATA via drivetemp)

- **System Fans**
  - Automatic detection of all fan sensors
  - Real-time RPM monitoring

- **Power Consumption**
  - System power draw monitoring
  - Per-component power usage (if sensors available)

- **Battery Monitoring**
  - Battery charge percentage
  - Charging/discharging status
  - Time remaining estimate
  - Voltage and current
  - Capacity and cycle count
  - Battery temperature

- **Network Monitoring**
  - Real-time upload/download speeds
  - Total data transferred per interface
  - Interface status

### 🎨 Beautiful UI

- Modern, responsive design with glassmorphism effects
- Color-coded temperature indicators
- Real-time progress bars and animations
- Per-core CPU visualization
- Support for multiple GPUs
- Dark theme optimized for long-term viewing

## Prerequisites

- Linux operating system
- Node.js (v14 or higher)
- npm or yarn

### System Requirements

The application reads data from various Linux system interfaces:

- `/sys/class/thermal/` - CPU temperatures
- `/sys/class/hwmon/` - Hardware monitoring (temps, fans, power)
- `/sys/devices/system/cpu/` - CPU frequencies
- `/sys/class/nvme/` - NVMe drive temperatures
- `/sys/class/power_supply/` - Battery information

For best results, ensure your kernel has the appropriate drivers loaded:
- `coretemp` or `k10temp` - CPU temperature
- `drivetemp` - SATA disk temperatures
- Hardware-specific drivers for fans and power sensors

## Installation

1. **Clone or download the project**
   ```bash
   cd /tmp/system-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

   For development mode with DevTools:
   ```bash
   npm run dev
   ```

## Building for Distribution

To package the application for distribution:

1. **Install electron-builder**
   ```bash
   npm install --save-dev electron-builder
   ```

2. **Add build configuration to package.json**
   ```json
   "build": {
     "appId": "com.system-monitor.app",
     "linux": {
       "target": ["AppImage", "deb", "rpm"],
       "category": "System"
     }
   }
   ```

3. **Add build script**
   ```json
   "scripts": {
     "build": "electron-builder"
   }
   ```

4. **Build the package**
   ```bash
   npm run build
   ```

## Permissions

The application reads system information from standard Linux interfaces. No special permissions are required for basic monitoring. However:

- Some sensors may require specific kernel modules to be loaded
- GPU monitoring works best with proprietary drivers (NVIDIA/AMD)
- Some power sensors may require root access (the app will skip unavailable sensors)

## Troubleshooting

### No temperature data

- Ensure temperature sensors are available: `ls /sys/class/thermal/`
- Install `lm-sensors`: `sudo apt install lm-sensors && sudo sensors-detect`
- Load appropriate kernel modules (`coretemp`, `k10temp`, etc.)

### No GPU data

- For NVIDIA: Install proprietary drivers and `nvidia-smi`
- For AMD: Ensure AMDGPU drivers are loaded
- The app uses the `systeminformation` library which may have limited GPU support on some configurations

### No fan data

- Check available fans: `ls /sys/class/hwmon/*/fan*_input`
- Some systems expose fan data through EC (embedded controller)
- Desktop motherboards usually have better fan sensor support

### No disk temperatures

- For NVMe: Built-in temperature sensors are usually available
- For SATA: Load the `drivetemp` kernel module: `sudo modprobe drivetemp`
- Some older drives don't have temperature sensors

### No power data

- Power sensors vary widely by hardware
- Laptops generally have better power monitoring
- Check: `ls /sys/class/hwmon/*/power*_input`

## Technical Details

### Architecture

- **Main Process** (`main.js`): Electron backend that handles system data collection
- **Preload Script** (`preload.js`): Secure IPC bridge between main and renderer
- **Renderer Process** (`renderer.js`): Frontend logic for data visualization
- **UI** (`index.html`, `styles.css`): Modern, responsive interface

### Data Sources

- **systeminformation library**: Cross-platform system information
- **Linux sysfs**: Direct access to kernel-exposed hardware data
- **Custom sensors**: Direct file system reads for enhanced data

### Update Frequency

- Default: 2 seconds
- Configurable in `renderer.js` (line 550)
- Balance between responsiveness and CPU usage

## Customization

### Change Update Interval

Edit `renderer.js`:
```javascript
// Update every X milliseconds (default: 2000 = 2 seconds)
setInterval(updateSystemData, 2000);
```

### Modify Color Scheme

Edit `styles.css` to change the gradient colors, backgrounds, or temperature thresholds.

### Add Custom Sensors

Edit `main.js` to add additional sensor reading logic in the system data collection functions.

## License

MIT License - Feel free to use and modify as needed.

## Contributing

Contributions are welcome! This is a comprehensive monitoring tool, but there's always room for improvement:

- Additional sensor support
- More detailed statistics
- Historical data and graphs
- Export capabilities
- System alerts and notifications

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- Linux kernel sysfs interfaces

---

**Note**: This application is designed specifically for Linux. Some features depend on available hardware sensors and kernel support. The app gracefully handles missing sensors by showing "No data available" messages.

