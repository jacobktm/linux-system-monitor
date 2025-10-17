// Disable GPU acceleration early to prevent crashes
const { app } = require('electron');
app.disableHardwareAcceleration();

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');
const fs = require('fs');
const { execSync } = require('child_process');
const SystemLogger = require('./logger');

let mainWindow;
let gpuType = null; // 'nvidia', 'amd', or null
let appInitialized = false;
let logger = null;

// Simple stats tracking
let simpleStats = {};

function updateSimpleStat(key, value) {
  if (value === null || value === undefined || isNaN(value)) {
    return;
  }
  
  if (!simpleStats[key]) {
    simpleStats[key] = {
      min: value,
      max: value,
      sum: value,
      count: 1,
      current: value
    };
  } else {
    simpleStats[key].min = Math.min(simpleStats[key].min, value);
    simpleStats[key].max = Math.max(simpleStats[key].max, value);
    simpleStats[key].sum += value;
    simpleStats[key].count++;
    simpleStats[key].current = value;
  }
}

function getSimpleStats() {
  const result = {};
  for (const [key, stat] of Object.entries(simpleStats)) {
    result[key] = {
      current: stat.current,
      min: stat.min,
      max: stat.max,
      avg: stat.sum / stat.count
    };
  }
  return result;
}

// Caching for expensive/static data with tiered update rates
let smartDataCache = null;
let smartDataCacheTime = 0;
const SMART_CACHE_DURATION = 60000; // 60 seconds

let staticDataCache = {
  cpu: null,
  osInfo: null,
  diskLayout: null,
  lastUpdate: 0
};
const STATIC_CACHE_DURATION = 30000; // 30 seconds

// Medium-speed data cache (battery, fans, power, some temps)
let mediumDataCache = {
  battery: null,
  fans: null,
  power: null,
  raplPower: null,
  diskTemps: null,
  cpuTemps: null,
  systemTemps: null,
  lastUpdate: 0
};

// GPU data cache
let gpuDataCache = null;
let gpuDataCacheTime = 0;
const GPU_CACHE_DURATION = 5000; // 5 seconds - GPU data changes less frequently
const MEDIUM_CACHE_DURATION = 1000; // 1 second


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#1a1a1a',
    frame: true,
    resizable: true,
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Initialize logger
  logger = new SystemLogger();
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Close logger and generate summary
  if (logger) {
    logger.close();
    logger = null;
  }
  
  // Clear all caches on shutdown
  smartDataCache = null;
  staticDataCache = { cpu: null, osInfo: null, diskLayout: null, lastUpdate: 0 };
  mediumDataCache = { battery: null, fans: null, power: null, raplPower: null, diskTemps: null, cpuTemps: null, systemTemps: null, lastUpdate: 0 };
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Periodic cache cleanup (every 2 minutes for high-frequency updates)
setInterval(() => {
  const now = Date.now();
  
  // Force refresh SMART cache if it's too old
  if (smartDataCache && (now - smartDataCacheTime) > (SMART_CACHE_DURATION * 3)) {
    smartDataCache = null;
    smartDataCacheTime = 0;
  }
  
  // Force garbage collection if available (more frequently due to 10 Hz updates)
  if (global.gc) {
    global.gc();
  }
}, 120000); // 2 minutes

// Helper function to read sensor data from sysfs
function readSensorFile(path) {
  try {
    return fs.readFileSync(path, 'utf8').trim();
  } catch (error) {
    return null;
  }
}

// Helper function to execute command safely
function execCommand(command) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      timeout: 5000,
      maxBuffer: 1024 * 1024, // 1MB max buffer
      killSignal: 'SIGTERM'
    }).trim();
    return result;
  } catch (error) {
    return null;
  }
}

// Detect GPU type on startup
function detectGPUType() {
  if (gpuType !== null) return gpuType;
  
  try {
    // Check for NVIDIA
    const nvidiaSmi = execCommand('which nvidia-smi');
    if (nvidiaSmi) {
      gpuType = 'nvidia';
      return gpuType;
    }
  } catch (e) {}
  
  try {
    // Check for AMD GPU via sysfs
    const drmDevices = fs.readdirSync('/sys/class/drm');
    for (const device of drmDevices) {
      if (device.startsWith('card') && !device.includes('-')) {
        const vendorPath = `/sys/class/drm/${device}/device/vendor`;
        const vendor = readSensorFile(vendorPath);
        if (vendor === '0x1002') {
          gpuType = 'amd';
          return gpuType;
        } else if (vendor === '0x10de') {
          gpuType = 'nvidia';
          return gpuType;
        }
      }
    }
  } catch (e) {}
  
  gpuType = 'unknown';
  return gpuType;
}

// Get NVIDIA GPU data using nvidia-smi
async function getNvidiaGPUData() {
  const output = execCommand(
    'nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,power.draw,power.limit,clocks.gr,clocks.mem,fan.speed --format=csv,noheader,nounits'
  );
  
  if (!output) return [];
  
  const lines = output.split('\n');
  const gpus = [];
  
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 13) {
      gpus.push({
        index: parseInt(parts[0]),
        vendor: 'NVIDIA',
        model: parts[1],
        temperatureGpu: parseFloat(parts[2]) || null,
        utilizationGpu: parseFloat(parts[3]) || null,
        utilizationMemory: parseFloat(parts[4]) || null,
        vram: parseInt(parts[5]) || null,
        vramUsed: parseInt(parts[6]) || null,
        vramFree: parseInt(parts[7]) || null,
        powerDraw: parseFloat(parts[8]) || null,
        powerLimit: parseFloat(parts[9]) || null,
        clockCore: parseInt(parts[10]) || null,
        clockMemory: parseInt(parts[11]) || null,
        fanSpeed: parseFloat(parts[12]) || null
      });
    }
  }
  
  return gpus;
}

// Get AMD GPU data from sysfs
async function getAMDGPUData() {
  const gpus = [];
  
  try {
    const drmDevices = fs.readdirSync('/sys/class/drm');
    for (const device of drmDevices) {
      if (device.startsWith('card') && !device.includes('-')) {
        const basePath = `/sys/class/drm/${device}/device`;
        const vendor = readSensorFile(`${basePath}/vendor`);
        
        if (vendor === '0x1002') {
          const model = readSensorFile(`${basePath}/product_name`) || 
                       readSensorFile(`${basePath}/name`) || 
                       'AMD GPU';
          
          // GPU utilization
          const gpuBusy = readSensorFile(`${basePath}/gpu_busy_percent`);
          
          // Memory info
          const vramTotal = readSensorFile(`${basePath}/mem_info_vram_total`);
          const vramUsed = readSensorFile(`${basePath}/mem_info_vram_used`);
          
          // Temperature
          let temp = null;
          const hwmonPath = `${basePath}/hwmon`;
          if (fs.existsSync(hwmonPath)) {
            const hwmonDirs = fs.readdirSync(hwmonPath);
            for (const hwmon of hwmonDirs) {
              const tempInput = readSensorFile(`${hwmonPath}/${hwmon}/temp1_input`);
              if (tempInput) {
                temp = parseInt(tempInput) / 1000;
                break;
              }
            }
          }
          
          // Power
          let powerDraw = null;
          let powerLimit = null;
          const power1Avg = readSensorFile(`${basePath}/hwmon/hwmon*/power1_average`);
          const power1Cap = readSensorFile(`${basePath}/hwmon/hwmon*/power1_cap`);
          if (power1Avg) powerDraw = parseInt(power1Avg) / 1000000;
          if (power1Cap) powerLimit = parseInt(power1Cap) / 1000000;
          
          // Clocks
          const coreClock = readSensorFile(`${basePath}/pp_dpm_sclk`);
          const memClock = readSensorFile(`${basePath}/pp_dpm_mclk`);
          
          gpus.push({
            vendor: 'AMD',
            model: model.trim(),
            temperatureGpu: temp,
            utilizationGpu: gpuBusy ? parseInt(gpuBusy) : null,
            utilizationMemory: null,
            vram: vramTotal ? parseInt(vramTotal) / (1024 * 1024) : null,
            vramUsed: vramUsed ? parseInt(vramUsed) / (1024 * 1024) : null,
            vramFree: (vramTotal && vramUsed) ? (parseInt(vramTotal) - parseInt(vramUsed)) / (1024 * 1024) : null,
            powerDraw: powerDraw,
            powerLimit: powerLimit,
            clockCore: null, // Parse from pp_dpm_sclk if needed
            clockMemory: null, // Parse from pp_dpm_mclk if needed
            fanSpeed: null
          });
        }
      }
    }
  } catch (error) {
    console.error('Error reading AMD GPU data:', error);
  }
  
  return gpus;
}

// Get GPU data based on detected type (cached)
async function getGPUData() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (gpuDataCache && (now - gpuDataCacheTime) < GPU_CACHE_DURATION) {
    return gpuDataCache;
  }
  
  const type = detectGPUType();
  let gpuData = [];
  
  if (type === 'nvidia') {
    gpuData = await getNvidiaGPUData();
  } else if (type === 'amd') {
    gpuData = await getAMDGPUData();
  } else {
    // Fallback to systeminformation
    try {
      const graphics = await si.graphics();
      gpuData = graphics.controllers.map(gpu => ({
        vendor: gpu.vendor,
        model: gpu.model,
        vram: gpu.vram,
        vramDynamic: gpu.vramDynamic,
        temperatureGpu: gpu.temperatureGpu,
        utilizationGpu: gpu.utilizationGpu,
        utilizationMemory: gpu.utilizationMemory,
        powerDraw: gpu.powerDraw,
        powerLimit: gpu.powerLimit,
        clockCore: gpu.clockCore,
        clockMemory: gpu.clockMemory,
        fanSpeed: gpu.fanSpeed
      }));
    } catch (e) {
      gpuData = [];
    }
  }
  
  // Cache the result
  gpuDataCache = gpuData;
  gpuDataCacheTime = now;
  
  return gpuData;
}

// Get SMART data for disks (cached)
async function getDiskSMARTData() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (smartDataCache && (now - smartDataCacheTime) < SMART_CACHE_DURATION) {
    return smartDataCache;
  }
  
  const smartData = {};
  
  // Check if smartctl is available
  const hasSmartctl = execCommand('which smartctl');
  if (!hasSmartctl) {
    smartDataCache = smartData;
    smartDataCacheTime = now;
    return smartData;
  }
  
  try {
    // Get list of block devices
    const devices = execCommand('lsblk -d -o NAME,TYPE -n | grep disk | awk \'{print $1}\'');
    if (!devices) return smartData;
    
    const deviceList = devices.split('\n');
    
    for (const device of deviceList) {
      const devPath = `/dev/${device}`;
      
      try {
        // Get SMART data in JSON format (requires smartmontools 7.0+)
        // Fall back to text parsing if JSON not available
        let output = execCommand(`sudo smartctl -A ${devPath} 2>/dev/null`);
        if (!output) output = execCommand(`smartctl -A ${devPath} 2>/dev/null`);
        
        if (output) {
          const data = {
            device: device,
            healthy: true,
            temperature: null,
            powerOnHours: null,
            powerCycles: null,
            wearLevel: null,
            reallocatedSectors: null,
            pendingSectors: null
          };
          
          // Parse SMART attributes
          const lines = output.split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 10) {
              const id = parts[0];
              const value = parts[9];
              
              // Temperature (194)
              if (id === '194') data.temperature = parseInt(value);
              // Power On Hours (9)
              if (id === '9') data.powerOnHours = parseInt(value);
              // Power Cycle Count (12)
              if (id === '12') data.powerCycles = parseInt(value);
              // Wear Leveling / SSD Life (231 or 233)
              if (id === '231' || id === '233') data.wearLevel = parseInt(parts[3]);
              // Reallocated Sectors (5)
              if (id === '5') {
                data.reallocatedSectors = parseInt(value);
                if (parseInt(value) > 0) data.healthy = false;
              }
              // Current Pending Sectors (197)
              if (id === '197') {
                data.pendingSectors = parseInt(value);
                if (parseInt(value) > 0) data.healthy = false;
              }
            }
          }
          
          smartData[device] = data;
        }
      } catch (e) {
        // Skip this device
      }
    }
  } catch (error) {
    console.error('Error reading SMART data:', error);
  }
  
  // Cache the result
  smartDataCache = smartData;
  smartDataCacheTime = now;
  
  return smartData;
}

// Helper function to get CPU frequencies
async function getCPUFrequencies() {
  const freqs = [];
  let i = 0;
  while (true) {
    const freq = readSensorFile(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`);
    if (freq === null) break;
    freqs.push(parseInt(freq) / 1000); // Convert kHz to MHz
    i++;
  }
  return freqs;
}

// Helper function to get CPU temperatures (all CPU sensors - package, cores, CCDs)
async function getCPUTemperatures() {
  const temps = [];
  
  // Try hwmon sensors - only CPU-related
  try {
    const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
    for (const hwmon of hwmonDirs) {
      const basePath = `/sys/class/hwmon/${hwmon}`;
      const name = readSensorFile(`${basePath}/name`);
      
      // Include CPU-related sensors
      // Intel: coretemp (Package + Per-Core temps), x86_pkg_temp, etc.
      // AMD: k10temp (Tctl package + Tccd1, Tccd2, etc per-CCD temps)
      if (name && (name.includes('coretemp') || name.includes('k10temp') || 
                    name.includes('zenpower') || name.includes('cpu_thermal') ||
                    name.includes('x86_pkg_temp'))) {
        
        // For Intel coretemp, scan all available temp sensors
        // For AMD k10temp, scan all available temp sensors
        // Scan up to 30 temp sensors to handle Intel systems with many cores
        let consecutiveMissing = 0;
        for (let j = 1; j <= 30; j++) {
          const temp = readSensorFile(`${basePath}/temp${j}_input`);
          if (temp === null) {
            consecutiveMissing++;
            // Stop if we've missed 5 consecutive sensors (Intel systems can have gaps)
            if (consecutiveMissing >= 5) break;
            continue;
          }
          consecutiveMissing = 0;
          
          const label = readSensorFile(`${basePath}/temp${j}_label`) || `${name}_temp${j}`;
          
          // Skip non-CPU labels if they exist
          const labelLower = label.toLowerCase();
          if (!labelLower.includes('gpu') && !labelLower.includes('ambient') && 
              !labelLower.includes('composite') && !labelLower.includes('nvme')) {
            temps.push({
              type: label,
              temp: parseInt(temp) / 1000,
              isCPU: true
            });
          }
        }
      }
    }
  } catch (e) {}
  
  // Also check thermal zones for additional CPU temperature sensors
  try {
    let i = 0;
    while (true) {
      const temp = readSensorFile(`/sys/class/thermal/thermal_zone${i}/temp`);
      if (temp === null) break;
      const type = readSensorFile(`/sys/class/thermal/thermal_zone${i}/type`);
      const typeStr = type || `zone${i}`;
      
      // Include CPU-related thermal zones
      const typeLower = typeStr.toLowerCase();
      if (typeLower.includes('cpu') || typeLower.includes('x86_pkg_temp') ||
          typeLower.includes('core') || typeLower.includes('package')) {
        temps.push({
          type: typeStr,
          temp: parseInt(temp) / 1000,
          isCPU: true
        });
      }
      i++;
    }
  } catch (e) {}
  
  // Sort temps to show package/Tctl first, then cores/CCDs
  temps.sort((a, b) => {
    const aType = a.type.toLowerCase();
    const bType = b.type.toLowerCase();
    
    // Package/Tctl comes first
    if (aType.includes('package') || aType.includes('tctl') || aType.includes('x86_pkg_temp')) return -1;
    if (bType.includes('package') || bType.includes('tctl') || bType.includes('x86_pkg_temp')) return 1;
    
    // Then sort by label
    return aType.localeCompare(bType);
  });
  
  return temps;
}

// Helper function to get system temperatures (non-CPU, non-GPU)
async function getSystemTemperatures() {
  const temps = [];
  
  // Try different thermal zones
  try {
    let i = 0;
    while (true) {
      const temp = readSensorFile(`/sys/class/thermal/thermal_zone${i}/temp`);
      if (temp === null) break;
      const type = readSensorFile(`/sys/class/thermal/thermal_zone${i}/type`);
      const typeStr = type || `zone${i}`;
      
      // Skip CPU-related and GPU-related thermal zones
      const typeLower = typeStr.toLowerCase();
      if (!typeLower.includes('cpu') && !typeLower.includes('x86_pkg_temp') &&
          !typeLower.includes('core') && !typeLower.includes('package') &&
          !typeLower.includes('gpu') && !typeLower.includes('nvidia') && 
          !typeLower.includes('amdgpu')) {
        temps.push({
          type: typeStr,
          temp: parseInt(temp) / 1000,
          isCPU: false
        });
      }
      i++;
    }
  } catch (e) {}
  
  // Try hwmon sensors (non-CPU, non-GPU, non-disk)
  try {
    const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
    for (const hwmon of hwmonDirs) {
      const basePath = `/sys/class/hwmon/${hwmon}`;
      const name = readSensorFile(`${basePath}/name`);
      
      // Skip CPU sensors, GPU sensors, NVMe sensors, and drivetemp
      if (name && !name.includes('coretemp') && !name.includes('k10temp') && 
          !name.includes('zenpower') && !name.includes('cpu_thermal') &&
          !name.includes('x86_pkg_temp') &&
          !name.includes('nouveau') && !name.includes('amdgpu') && !name.includes('radeon') &&
          name !== 'nvme' && !name.includes('drivetemp')) {
        let j = 1;
        while (true) {
          const temp = readSensorFile(`${basePath}/temp${j}_input`);
          if (temp === null) break;
          const label = readSensorFile(`${basePath}/temp${j}_label`) || `${name}_temp${j}`;
          
          // Double-check: Skip if label contains "Composite" or CPU-related terms
          const labelLower = label.toLowerCase();
          if (!labelLower.includes('composite') && !labelLower.includes('cpu') &&
              !labelLower.includes('core') && !labelLower.includes('package')) {
            temps.push({
              type: label,
              temp: parseInt(temp) / 1000,
              isCPU: false
            });
          }
          j++;
        }
      }
    }
  } catch (e) {}
  
  return temps;
}

// Helper function to get fan speeds
async function getFanSpeeds() {
  const fans = [];
  
  try {
    const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
    for (const hwmon of hwmonDirs) {
      const basePath = `/sys/class/hwmon/${hwmon}`;
      const name = readSensorFile(`${basePath}/name`);
      
      let j = 1;
      while (true) {
        const fan = readSensorFile(`${basePath}/fan${j}_input`);
        if (fan === null) break;
        const label = readSensorFile(`${basePath}/fan${j}_label`) || `${name}_fan${j}`;
        fans.push({
          label: label,
          rpm: parseInt(fan)
        });
        j++;
      }
    }
  } catch (error) {
    // Fans not available
  }
  
  return fans;
}

// Helper function to get power consumption
async function getPowerConsumption() {
  const power = [];
  
  try {
    const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
    for (const hwmon of hwmonDirs) {
      const basePath = `/sys/class/hwmon/${hwmon}`;
      const name = readSensorFile(`${basePath}/name`);
      
      let j = 1;
      while (true) {
        const powerInput = readSensorFile(`${basePath}/power${j}_input`);
        if (powerInput === null) break;
        const label = readSensorFile(`${basePath}/power${j}_label`) || `${name}_power${j}`;
        power.push({
          label: label,
          watts: parseInt(powerInput) / 1000000 // Convert microwatts to watts
        });
        j++;
      }
    }
  } catch (error) {
    // Power sensors not available
  }
  
  return power;
}

// Helper function to get DDR5 memory temperatures (spd5118 sensors)
async function getDDR5MemoryTemps() {
  const memoryTemps = [];
  
  try {
    const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
    for (const hwmon of hwmonDirs) {
      const basePath = `/sys/class/hwmon/${hwmon}`;
      const name = readSensorFile(`${basePath}/name`);
      
      // Look for spd5118 sensors (DDR5 memory temperature sensors)
      if (name && name.includes('spd5118')) {
        let j = 1;
        while (true) {
          const tempInput = readSensorFile(`${basePath}/temp${j}_input`);
          if (tempInput === null) break;
          
          const label = readSensorFile(`${basePath}/temp${j}_label`) || `DDR5_Module_${j}`;
          
          memoryTemps.push({
            label: label,
            temp: parseInt(tempInput) / 1000 // Convert millidegrees to degrees
          });
          j++;
        }
      }
    }
  } catch (error) {
    // DDR5 memory temperature sensors not available
  }
  
  return memoryTemps;
}

// Intel RAPL power monitoring
let raplData = {
  previousEnergy: {},
  previousTime: 0,
  powerReadings: {},
  stats: {}
};

// Helper function to get Intel RAPL power data
async function getIntelRAPLPower() {
  const raplPower = {};
  
  try {
    // Check if Intel RAPL is available
    const raplPath = '/sys/class/powercap/intel-rapl';
    if (!fs.existsSync(raplPath)) {
      return raplPower;
    }
    
    const raplDirs = fs.readdirSync(raplPath).filter(d => d.startsWith('intel-rapl:'));
    
    for (const raplDir of raplDirs) {
      const basePath = `${raplPath}/${raplDir}`;
      const name = readSensorFile(`${basePath}/name`);
      
      if (!name) continue;
      
      // Read energy in microjoules
      const energyStr = readSensorFile(`${basePath}/energy_uj`);
      if (!energyStr) {
        // If we can't read energy, skip this RAPL domain
        continue;
      }
      
      const energy = parseInt(energyStr);
      const currentTime = Date.now();
      
      // Initialize previous data if not exists
      if (!raplData.previousEnergy[name]) {
        raplData.previousEnergy[name] = energy;
        raplData.previousTime = currentTime;
        raplData.powerReadings[name] = [];
        raplData.stats[name] = {
          min: null,
          max: null,
          sum: 0,
          count: 0,
          current: 0
        };
        continue;
      }
      
      // Calculate power consumption
      const timeDelta = (currentTime - raplData.previousTime) / 1000; // seconds
      const energyDelta = energy - raplData.previousEnergy[name]; // microjoules
      
      // Convert to watts: microjoules / seconds / 1,000,000
      let powerWatts = energyDelta / (timeDelta * 1000000);
      
      // Outlier filtering
      if (timeDelta > 0 && timeDelta < 10 && // Reasonable time delta (0-10 seconds)
          energyDelta >= 0 && // Energy should not decrease (no negative power)
          powerWatts >= 0 && powerWatts < 1000) { // Reasonable power range (0-1000W)
        
        // Store the reading
        raplData.powerReadings[name].push(powerWatts);
        
        // Keep only last 100 readings for rolling average
        if (raplData.powerReadings[name].length > 100) {
          raplData.powerReadings[name].shift();
        }
        
        // Calculate rolling average (last 10 readings)
        const recentReadings = raplData.powerReadings[name].slice(-10);
        const avgPower = recentReadings.reduce((a, b) => a + b, 0) / recentReadings.length;
        
        // Update statistics
        const stats = raplData.stats[name];
        if (stats.min === null || avgPower < stats.min) stats.min = avgPower;
        if (stats.max === null || avgPower > stats.max) stats.max = avgPower;
        stats.sum += avgPower;
        stats.count++;
        stats.current = avgPower;
        
        raplPower[name] = {
          power: avgPower,
          energy: energy / 1000000, // Convert to joules
          stats: {
            current: stats.current,
            min: stats.min,
            max: stats.max,
            avg: stats.sum / stats.count
          }
        };
      }
      
      // Update previous values
      raplData.previousEnergy[name] = energy;
      raplData.previousTime = currentTime;
    }
  } catch (error) {
    // Silently handle errors - RAPL data is optional
  }
  
  return raplPower;
}

// Helper function to get per-disk I/O stats from /proc/diskstats
async function getPerDiskIO() {
  const diskIO = {};
  
  try {
    const diskstats = fs.readFileSync('/proc/diskstats', 'utf8');
    const lines = diskstats.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 14) {
        const deviceName = parts[2];
        
        // Only include main block devices (skip partitions)
        if (deviceName.match(/^(sd[a-z]|nvme[0-9]+n[0-9]+|vd[a-z]|hd[a-z])$/)) {
          diskIO[deviceName] = {
            device: deviceName,
            readsCompleted: parseInt(parts[3]),
            readsSectors: parseInt(parts[5]),
            writesCompleted: parseInt(parts[7]),
            writesSectors: parseInt(parts[9]),
            // Convert sectors to bytes (512 bytes per sector)
            readBytes: parseInt(parts[5]) * 512,
            writeBytes: parseInt(parts[9]) * 512
          };
        }
      }
    }
  } catch (e) {
    console.error('Error reading diskstats:', e);
  }
  
  return diskIO;
}

// Cache for calculating per-disk I/O rates
let prevDiskIO = {};
let prevDiskIOTime = 0;

// Calculate per-disk I/O rates
async function getPerDiskIORates() {
  const currentIO = await getPerDiskIO();
  const currentTime = Date.now();
  const rates = {};
  
  if (prevDiskIOTime > 0) {
    const timeDelta = (currentTime - prevDiskIOTime) / 1000; // seconds
    
    for (const [device, current] of Object.entries(currentIO)) {
      const prev = prevDiskIO[device];
      if (prev) {
        const readDelta = current.readBytes - prev.readBytes;
        const writeDelta = current.writeBytes - prev.writeBytes;
        
        rates[device] = {
          device: device,
          readBytesPerSec: readDelta / timeDelta,
          writeBytesPerSec: writeDelta / timeDelta
        };
      }
    }
  }
  
  prevDiskIO = currentIO;
  prevDiskIOTime = currentTime;
  
  return rates;
}

// Helper function to get disk temperatures
async function getDiskTemperatures() {
  const diskTemps = {};  // Use object keyed by device name
  
  try {
    // NVMe drives are in /sys/class/hwmon with name "nvme"
    const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
    
    for (const hwmon of hwmonDirs) {
      const basePath = `/sys/class/hwmon/${hwmon}`;
      const name = readSensorFile(`${basePath}/name`);
      
      // Check if this is an NVMe sensor
      if (name && name === 'nvme') {
        // Find which NVMe device this belongs to by checking the device symlink
        try {
          const deviceLink = fs.realpathSync(`${basePath}/device`);
          // Extract nvme number from path like /sys/devices/.../nvme/nvme0
          const nvmeMatch = deviceLink.match(/nvme\/nvme(\d+)$/);
          
          if (nvmeMatch) {
            const nvmeNum = nvmeMatch[1];
            const deviceName = `nvme${nvmeNum}n1`; // nvme0 -> nvme0n1
            
            // Look for Composite temperature (most reliable for NVMe)
            for (let i = 1; i <= 10; i++) {
              const tempLabel = readSensorFile(`${basePath}/temp${i}_label`);
              const tempInput = readSensorFile(`${basePath}/temp${i}_input`);
              
              if (tempInput) {
                // Prefer Composite temperature
                if (tempLabel && tempLabel.toLowerCase().includes('composite')) {
                  diskTemps[deviceName] = parseInt(tempInput) / 1000;
                  break;
                } else if (i === 1 && !diskTemps[deviceName]) {
                  // Fallback to first sensor if no Composite found
                  diskTemps[deviceName] = parseInt(tempInput) / 1000;
                }
              }
            }
          }
        } catch (e) {
          // Could not resolve device link
        }
      }
    }
    
    // Check for SATA drives via drivetemp
    try {
      const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
      for (const hwmon of hwmonDirs) {
        const basePath = `/sys/class/hwmon/${hwmon}`;
        const name = readSensorFile(`${basePath}/name`);
        
        if (name && name.includes('drivetemp')) {
          const temp = readSensorFile(`${basePath}/temp1_input`);
          // Try to find which device this belongs to
          const deviceLink = readSensorFile(`${basePath}/device`);
          if (temp && deviceLink) {
            // Extract device name from path like /sys/block/sda
            const match = deviceLink.match(/\/block\/([^\/]+)/);
            if (match) {
              diskTemps[match[1]] = parseInt(temp) / 1000;
            }
          } else if (temp) {
            // Fallback: use hwmon name
            diskTemps[name] = parseInt(temp) / 1000;
          }
        }
      }
    } catch (e) {}
  } catch (error) {
    console.error('Error reading disk temperatures:', error);
  }
  
  return diskTemps;
}

// IPC Handler for system data with tiered caching
ipcMain.handle('get-system-data', async () => {
  // Add initialization delay for first few calls to allow GPU detection to stabilize
  if (!appInitialized) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    appInitialized = true;
  }
  
  console.log('IPC handler called - starting data fetch');
  try {
    console.log('Starting data collection...');
    const now = Date.now();
    const needsStaticUpdate = !staticDataCache.cpu || (now - staticDataCache.lastUpdate) > STATIC_CACHE_DURATION;
    const needsMediumUpdate = !mediumDataCache.battery || (now - mediumDataCache.lastUpdate) > MEDIUM_CACHE_DURATION;
    
    // Update static data cache if needed (every 30s)
    if (needsStaticUpdate) {
      console.log('Updating static data cache...');
      try {
        const [cpu, osInfo, diskLayout] = await Promise.all([
          si.cpu(),
          si.osInfo(),
          si.diskLayout()
        ]);
        staticDataCache.cpu = cpu;
        staticDataCache.osInfo = osInfo;
        staticDataCache.diskLayout = diskLayout;
        staticDataCache.lastUpdate = now;
        console.log('Static data cache updated successfully');
      } catch (error) {
        console.error('Error updating static data cache:', error);
        throw error;
      }
    }
    
    // Update medium-speed data cache if needed (every 1s)
    if (needsMediumUpdate) {
      console.log('Updating medium data cache...');
      try {
        const [battery, fans, power, raplPower, diskTemps, cpuTemps, systemTemps, ddr5Temps] = await Promise.all([
          si.battery(),
          getFanSpeeds(),
          getPowerConsumption(),
          getIntelRAPLPower(),
          getDiskTemperatures(),
          getCPUTemperatures(),
          getSystemTemperatures(),
          getDDR5MemoryTemps()
        ]);
        mediumDataCache.battery = battery;
        mediumDataCache.fans = fans;
        mediumDataCache.power = power;
        mediumDataCache.raplPower = raplPower;
        mediumDataCache.diskTemps = diskTemps;
        mediumDataCache.cpuTemps = cpuTemps;
        mediumDataCache.systemTemps = systemTemps;
        mediumDataCache.ddr5Temps = ddr5Temps;
        mediumDataCache.lastUpdate = now;
        console.log('Medium data cache updated successfully');
      } catch (error) {
        console.error('Error updating medium data cache:', error);
        throw error;
      }
    }
    
    // Fetch fast-updating data (every 100ms) - only the essentials
    console.log('Fetching fast-updating data...');
    let cpuLoad, cpuTemp, cpuFreqs, mem, diskIO, perDiskIO, gpuData, networkStats, diskSmart;
    
    try {
      [
        cpuLoad,
        cpuTemp,
        cpuFreqs,
        mem,
        diskIO,
        perDiskIO,
        gpuData,
        networkStats
      ] = await Promise.all([
        si.currentLoad(),
        si.cpuTemperature(),
        getCPUFrequencies(),
        si.mem(),
        si.disksIO(),
        getPerDiskIORates(),
        getGPUData(),
        si.networkStats()
      ]);
      console.log('Fast data fetched successfully');
    
      // Get SMART data (cached for 60s)
      diskSmart = await getDiskSMARTData();
    } catch (error) {
      console.error('Error fetching fast data:', error);
      throw error;
    }
    
    // Use cached data (with fallback for first run)
    const cpu = staticDataCache.cpu || await si.cpu();
    const osInfo = staticDataCache.osInfo || await si.osInfo();
    const diskLayout = staticDataCache.diskLayout || await si.diskLayout();
    const battery = mediumDataCache.battery || await si.battery();
    const fans = mediumDataCache.fans || [];
    const power = mediumDataCache.power || [];
    const raplPower = mediumDataCache.raplPower || {};
    const diskTemps = mediumDataCache.diskTemps || [];
    const cpuTemps = mediumDataCache.cpuTemps || [];
    const systemTemps = mediumDataCache.systemTemps || [];
    const ddr5Temps = mediumDataCache.ddr5Temps || [];

    // Calculate per-core usage
    const coreLoads = cpuLoad.cpus || [];

    const result = {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        governor: cpu.governor,
        currentLoad: cpuLoad.currentLoad,
        coreLoads: coreLoads.map(core => ({
          load: core.load,
          loadUser: core.loadUser,
          loadSystem: core.loadSystem,
          loadIdle: core.loadIdle
        })),
        frequencies: cpuFreqs,
        temperature: {
          main: cpuTemp.main,
          cores: cpuTemp.cores,
          max: cpuTemp.max,
          sensors: cpuTemps
        }
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        active: mem.active,
        available: mem.available,
        usedPercent: (mem.used / mem.total) * 100,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
        swapFree: mem.swapfree,
        ddr5Temps: ddr5Temps
      },
      disk: {
        layout: diskLayout.map(disk => ({
          device: disk.device,
          type: disk.type,
          name: disk.name,
          size: disk.size,
          temperature: disk.temperature
        })),
        io: {
          rIO: diskIO.rIO,
          wIO: diskIO.wIO,
          tIO: diskIO.tIO,
          rIO_sec: diskIO.rIO_sec,
          wIO_sec: diskIO.wIO_sec,
          tIO_sec: diskIO.tIO_sec,
          ms: diskIO.ms
        },
        perDiskIO: perDiskIO,
        temperatures: diskTemps,
        smart: diskSmart
      },
      battery: battery.hasBattery ? {
        hasBattery: true,
        cycleCount: battery.cycleCount,
        isCharging: battery.isCharging,
        percent: battery.percent,
        timeRemaining: battery.timeRemaining,
        acConnected: battery.acConnected,
        type: battery.type,
        model: battery.model,
        manufacturer: battery.manufacturer,
        currentCapacity: battery.currentCapacity,
        maxCapacity: battery.maxCapacity,
        voltage: battery.voltage,
        capacityUnit: battery.capacityUnit,
        temperature: battery.temperature
      } : { hasBattery: false },
      gpu: gpuData,
      network: networkStats.map(net => ({
        iface: net.iface,
        operstate: net.operstate,
        rx_bytes: net.rx_bytes,
        tx_bytes: net.tx_bytes,
        rx_sec: net.rx_sec,
        tx_sec: net.tx_sec
      })),
      system: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptime: si.time().uptime
      },
      fans: fans,
      power: power,
      raplPower: raplPower,
      systemTemps: systemTemps,
      timestamp: Date.now(),
      stats: {} // Initialize stats object
    };
    
    // Track stats with simple system
    updateSimpleStat('cpu_usage', result.cpu.currentLoad);
    updateSimpleStat('mem_percent', result.memory.usedPercent);
    
    // Track per-core CPU usage
    if (result.cpu.coreLoads) {
      result.cpu.coreLoads.forEach((core, i) => {
        updateSimpleStat(`cpu_core${i}_usage`, core.load);
      });
    }
    
    // Track CPU temperatures
    if (result.cpu.temperature && result.cpu.temperature.sensors) {
      result.cpu.temperature.sensors.forEach(sensor => {
        const key = `cpu_temp_${sensor.type.replace(/[^a-zA-Z0-9]/g, '_')}`;
        updateSimpleStat(key, sensor.temp);
      });
    }
    
    // Track CPU frequencies
    if (result.cpu.frequencies && result.cpu.frequencies.length > 0) {
      // Track average frequency
      const avgFreq = result.cpu.frequencies.reduce((a, b) => a + b, 0) / result.cpu.frequencies.length;
      updateSimpleStat('cpu_avg_freq', avgFreq);
      
      // Track individual core frequencies
      result.cpu.frequencies.forEach((freq, i) => {
        updateSimpleStat(`cpu_core${i}_freq`, freq);
      });
    }
    
    // Track GPU stats
    if (result.gpu && result.gpu.length > 0) {
      const gpu = result.gpu[0];
      if (gpu.utilizationGpu !== null) updateSimpleStat('gpu_usage', gpu.utilizationGpu);
      if (gpu.temperatureGpu !== null) updateSimpleStat('gpu_temp', gpu.temperatureGpu);
      if (gpu.powerDraw !== null) updateSimpleStat('gpu_power', gpu.powerDraw);
    }
    
    // Track Intel RAPL power stats
    if (result.raplPower) {
      Object.entries(result.raplPower).forEach(([name, raplData]) => {
        const key = `rapl_${name.replace(/[^a-zA-Z0-9]/g, '_')}_power`;
        updateSimpleStat(key, raplData.power);
      });
    }
    
    // Track fan speeds
    if (result.fans && result.fans.length > 0) {
      result.fans.forEach((fan, i) => {
        updateSimpleStat(`fan_${i}_speed`, fan.speed);
      });
    }
    
    // Track disk I/O
    if (result.disk.perDiskIO) {
      Object.entries(result.disk.perDiskIO).forEach(([device, diskIO]) => {
        updateSimpleStat(`disk_${device}_read`, diskIO.readBytesPerSec);
        updateSimpleStat(`disk_${device}_write`, diskIO.writeBytesPerSec);
      });
    }
    
    // Track disk temperatures
    if (result.disk.temperatures) {
      Object.entries(result.disk.temperatures).forEach(([device, temp]) => {
        updateSimpleStat(`disk_${device}_temp`, temp);
      });
    }
    
    // Track DDR5 memory temperatures
    if (result.memory.ddr5Temps && result.memory.ddr5Temps.length > 0) {
      result.memory.ddr5Temps.forEach((memTemp, index) => {
        updateSimpleStat(`ddr5_module_${index}_temp`, memTemp.temp);
      });
    }
    
    // Log the data
    if (logger) {
      logger.logData(result);
    }
    
    // Add statistics to response
    const stats = getSimpleStats();
    result.stats = stats;
    return result;
  } catch (error) {
    console.error('Error fetching system data:', error);
    throw error;
  }
});

