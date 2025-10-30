const si = require('systeminformation');
const fs = require('fs');

class HybridSystemMonitor {
    constructor() {
        this.nativeMonitor = null;
        this.useNative = false;
        this.nativeFeatures = {
            rapl: false,
            battery: false,
            cpuFreq: true,
            cpuTemp: true,
            ddr5: true
        };
        this.simpleStats = {};
        this.init();
    }

    init() {
        try {
            const NativeSystemMonitor = require('./native_monitor');
            this.nativeMonitor = new NativeSystemMonitor();
            if (this.nativeMonitor.isInitialized()) {
                this.useNative = true;
                // Check which native features are available
                this.checkNativeFeatures();
                console.log('Using native system monitor for improved performance');
            } else {
                console.log('Native monitor not available, using JavaScript fallback');
            }
        } catch (error) {
            console.log('Native monitor not available, using JavaScript fallback:', error.message);
        }
    }

    checkNativeFeatures() {
        if (!this.nativeMonitor) return;
        try {
            // Check if RAPL function exists
            if (typeof this.nativeMonitor.getRAPLPowerCalculated === 'function') {
                this.nativeFeatures.rapl = true;
            }
            // Check if battery function exists
            if (typeof this.nativeMonitor.getBatteryCalculated === 'function') {
                this.nativeFeatures.battery = true;
            }
        } catch (e) {
            // Feature check failed
        }
    }

    isUsingNative() {
        return this.useNative;
    }

    // CPU Core Frequencies - use native if available
    async getCPUFrequencies() {
        if (this.useNative) {
            try {
                const cores = this.nativeMonitor.getCPUCores();
                return cores.map(core => core.frequency);
            } catch (error) {
                console.warn('Native CPU frequency failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback
        const cpu = await si.cpu();
        const cores = [];
        for (let i = 0; i < cpu.cores; i++) {
            cores.push(cpu.speed || 0);
        }
        return cores;
    }

    // CPU Temperature Sensors - use native if available
    async getCPUTemperatures() {
        if (this.useNative) {
            try {
                const sensors = this.nativeMonitor.getTemperatureSensors();
                return sensors.map(sensor => ({
                    type: sensor.label,
                    temp: sensor.value,
                    isCPU: true
                }));
            } catch (error) {
                console.warn('Native temperature sensors failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback - use existing function
        return await this.getCPUTemperaturesJS();
    }

    // DDR5 Memory Temperatures - use native if available
    async getDDR5MemoryTemps() {
        if (this.useNative) {
            try {
                const sensors = this.nativeMonitor.getDDR5Temperatures();
                return sensors.map(sensor => ({
                    label: sensor.label,
                    temp: sensor.value
                }));
            } catch (error) {
                console.warn('Native DDR5 temperatures failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback - use existing function
        return await this.getDDR5MemoryTempsJS();
    }

    // RAPL Power - use native if available
    async getIntelRAPLPower() {
        if (this.nativeFeatures.rapl) {
            try {
                // Use the new native C implementation with power calculations
                const powerData = this.nativeMonitor.getRAPLPowerCalculated();
                const raplPower = {};
                powerData.forEach(power => {
                    raplPower[power.name] = {
                        power: power.power,
                        energy: power.energy, // joules
                        totalWh: power.totalWh,
                        totalKWh: power.totalKWh,
                        stats: {
                            current: power.power,
                            min: power.min_power,
                            max: power.max_power,
                            avg: power.avg_power
                        }
                    };
                });
                
                // Store last valid values for persistence
                if (Object.keys(raplPower).length > 0) {
                    this.lastValidRAPLData = raplPower;
                }
                
                // Return current data if available, otherwise return last valid data
                return Object.keys(raplPower).length > 0 ? raplPower : (this.lastValidRAPLData || {});
            } catch (error) {
                console.warn('Native RAPL power calculated failed, falling back to JavaScript:', error.message);
                this.nativeFeatures.rapl = false;
            }
        }
        
        // JavaScript fallback - use existing function
        console.log('🔧 RAPL: Using JavaScript fallback (native not available)');
        const jsResult = await this.getIntelRAPLPowerJS();
        
        // Store last valid values for persistence
        if (Object.keys(jsResult).length > 0) {
            this.lastValidRAPLData = jsResult;
        }
        
        // Return current data if available, otherwise return last valid data
        return Object.keys(jsResult).length > 0 ? jsResult : (this.lastValidRAPLData || {});
    }

    // Battery sensors - use native if available
    async getBatterySensors() {
        if (this.nativeFeatures.battery) {
            try {
                const bat = this.nativeMonitor.getBatteryCalculated();
                if (bat) return bat;
            } catch (error) {
                console.warn('Native battery sensors failed, falling back to JavaScript:', error.message);
                this.nativeFeatures.battery = false;
            }
        }
        // JavaScript fallback using systeminformation + sysfs
        const si = require('systeminformation');
        const baseDir = '/sys/class/power_supply';
        let voltage = null, current = null, powerWatts = null, estimatedHours = null, acConnected = null, status = null, state = 'unknown', energyNowWh = null, energyFullWh = null;
        try {
            const fs = require('fs');
            const entries = fs.readdirSync(baseDir);
            const bat = entries.find(e => e.toLowerCase().startsWith('bat'));
            const ac = entries.find(e => e.toLowerCase().startsWith('ac') || e.toLowerCase().includes('ac'));
            const read = (p) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } };
            if (bat) {
                const bp = `${baseDir}/${bat}`;
                status = read(`${bp}/status`);
                if (ac) acConnected = read(`${baseDir}/${ac}/online`) === '1';
                const v = read(`${bp}/voltage_now`);
                const c = read(`${bp}/current_now`);
                const p = read(`${bp}/power_now`);
                voltage = v ? parseInt(v) / 1_000_000 : null;
                current = c ? parseInt(c) / 1_000_000 : null;
                powerWatts = p ? parseInt(p) / 1_000_000 : (voltage != null && current != null ? voltage * current : null);
                if (current != null && current < 0) current = Math.abs(current);
                if (powerWatts != null && powerWatts < 0) powerWatts = Math.abs(powerWatts);
                const en = read(`${bp}/energy_now`);
                const ef = read(`${bp}/energy_full`);
                if (en && ef) {
                    energyNowWh = parseInt(en) / 1_000_000;
                    energyFullWh = parseInt(ef) / 1_000_000;
                }
                if (powerWatts != null && powerWatts > 0 && energyNowWh) {
                    const sl = (status || '').toLowerCase();
                    if (sl.includes('discharging')) estimatedHours = energyNowWh / powerWatts;
                    else if (sl.includes('charging') && energyFullWh) {
                        estimatedHours = Math.max(energyFullWh - energyNowWh, 0) / powerWatts;
                    }
                }
                const sl = (status || '').toLowerCase();
                if (sl.includes('charging')) state = 'charging';
                else if (sl.includes('discharging')) state = 'discharging';
                else if (sl.includes('full')) state = 'full';
                else if (sl.includes('not charging')) state = acConnected ? 'idle' : 'discharging';
                else state = acConnected ? 'idle' : 'discharging';
                if (acConnected && (state === 'charging' || state === 'idle' || state === 'full')) {
                    if (powerWatts == null) powerWatts = 0;
                    if (current == null) current = 0;
                }
            }
        } catch {}
        return { status, acConnected, voltage, current, powerWatts, estimatedHours, state, energyNowWh, energyFullWh };
    }

    // Statistics - use native if available
    updateStats(key, value) {
        if (this.useNative) {
            try {
                this.nativeMonitor.updateStats(key, value);
                return;
            } catch (error) {
                console.warn('Native stats update failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback - use existing function
        this.updateStatsJS(key, value);
    }

    // Check if last valid value exists
    hasLastValidValue(key) {
        if (this.useNative) {
            try {
                return this.nativeMonitor.hasLastValidValue(key);
            } catch (error) {
                console.warn('Native hasLastValidValue failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback
        return this.simpleStats && this.simpleStats[key] && this.simpleStats[key].current !== undefined;
    }

    // Get last valid value
    getLastValidValue(key) {
        if (this.useNative) {
            try {
                return this.nativeMonitor.getLastValidValue(key);
            } catch (error) {
                console.warn('Native getLastValidValue failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback
        return this.simpleStats && this.simpleStats[key] ? this.simpleStats[key].current : 0;
    }

    getStats() {
        if (this.useNative) {
            try {
                return this.nativeMonitor.getStats();
            } catch (error) {
                console.warn('Native stats get failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback - use existing function
        return this.getStatsJS();
    }

    // Helper function to read sensor files
    readSensorFile(path) {
        try {
            return fs.readFileSync(path, 'utf8').trim();
        } catch (error) {
            return null;
        }
    }

    // JavaScript fallback functions (copied from main.js)
    async getCPUTemperaturesJS() {
        const temps = [];
        
        // Try hwmon sensors - only CPU-related
        try {
            const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
            for (const hwmon of hwmonDirs) {
                const basePath = `/sys/class/hwmon/${hwmon}`;
                const name = this.readSensorFile(`${basePath}/name`);
                
                // Include CPU-related sensors
                if (name && (name.includes('coretemp') || name.includes('k10temp') || 
                              name.includes('zenpower') || name.includes('cpu_thermal') ||
                              name.includes('x86_pkg_temp'))) {
                    
                    let consecutiveMissing = 0;
                    for (let j = 1; j <= 30; j++) {
                        const temp = this.readSensorFile(`${basePath}/temp${j}_input`);
                        if (temp === null) {
                            consecutiveMissing++;
                            if (consecutiveMissing >= 5) break;
                            continue;
                        }
                        consecutiveMissing = 0;
                        
                        const label = this.readSensorFile(`${basePath}/temp${j}_label`) || `${name}_temp${j}`;
                        
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
        
        // Also check thermal zones
        try {
            let i = 0;
            while (true) {
                const temp = this.readSensorFile(`/sys/class/thermal/thermal_zone${i}/temp`);
                if (temp === null) break;
                const type = this.readSensorFile(`/sys/class/thermal/thermal_zone${i}/type`);
                const typeStr = type || `zone${i}`;
                
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
        
        // Sort temps
        temps.sort((a, b) => {
            const aType = a.type.toLowerCase();
            const bType = b.type.toLowerCase();
            
            if (aType.includes('package') || aType.includes('tctl') || aType.includes('x86_pkg_temp')) return -1;
            if (bType.includes('package') || bType.includes('tctl') || bType.includes('x86_pkg_temp')) return 1;
            
            return aType.localeCompare(bType);
        });
        
        return temps;
    }

    async getDDR5MemoryTempsJS() {
        const memoryTemps = [];
        
        try {
            const hwmonDirs = fs.readdirSync('/sys/class/hwmon').filter(d => d.startsWith('hwmon'));
            for (const hwmon of hwmonDirs) {
                const basePath = `/sys/class/hwmon/${hwmon}`;
                const name = this.readSensorFile(`${basePath}/name`);
                
                if (name && name.includes('spd5118')) {
                    let j = 1;
                    while (true) {
                        const tempInput = this.readSensorFile(`${basePath}/temp${j}_input`);
                        if (tempInput === null) break;
                        
                        const label = this.readSensorFile(`${basePath}/temp${j}_label`) || `DDR5_Module_${j}`;
                        
                        memoryTemps.push({
                            label: label,
                            temp: parseInt(tempInput) / 1000
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

    async getIntelRAPLPowerJS() {
        // Use the main.js power calculation function
        return await this.getIntelRAPLPowerMain();
    }

    async getIntelRAPLPowerMain() {
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
                const name = this.readSensorFile(`${basePath}/name`);
                
                if (!name) continue;
                
                // Read energy in microjoules
                const energyStr = this.readSensorFile(`${basePath}/energy_uj`);
                if (!energyStr) continue;
                
                const energy = parseInt(energyStr);
                const currentTime = performance.now() * 1000; // Convert to microseconds
                
                // Initialize previous data if not exists
                if (!this.raplData) {
                    this.raplData = {
                        previousEnergy: {},
                        previousTime: {},
                        powerReadings: {},
                        stats: {}
                    };
                }
                
                if (!this.raplData.previousEnergy[name]) {
                    this.raplData.previousEnergy[name] = energy;
                    this.raplData.previousTime[name] = currentTime;
                    this.raplData.powerReadings[name] = [];
                    this.raplData.stats[name] = {
                        min: null,
                        max: null,
                        sum: 0,
                        count: 0,
                        current: 0
                    };
                    continue;
                }
                
                // Calculate power consumption
                const timeDelta = (currentTime - this.raplData.previousTime[name]) / 1000000; // seconds (from microseconds)
                let energyDelta = energy - this.raplData.previousEnergy[name]; // microjoules
                
                // Handle energy counter overflow (32-bit counter wraps around at ~2^32)
                const MAX_ENERGY = Math.pow(2, 32); // 4,294,967,296 μJ
                if (energyDelta < 0) {
                    // Counter wrapped around
                    energyDelta = energy + (MAX_ENERGY - this.raplData.previousEnergy[name]);
                }
                
                // Convert to watts: microjoules / seconds / 1,000,000
                // timeDelta is in seconds (converted from microseconds)
                // We need: (μJ / seconds) / 1,000,000 = J/s = W
                let powerWatts = energyDelta / timeDelta / 1000000;
                
                // Outlier filtering
                if (timeDelta > 0.1 && timeDelta < 10 && // Reasonable time delta (0.1-10 seconds)
                    energyDelta >= 0 && // Energy should not decrease (no negative power)
                    powerWatts >= 0 && powerWatts < 1000) { // Reasonable power range (0-1000W)
                    
                    // Store the reading
                    this.raplData.powerReadings[name].push(powerWatts);
                    
                    // Keep only last 100 readings for rolling average
                    if (this.raplData.powerReadings[name].length > 100) {
                        this.raplData.powerReadings[name].shift();
                    }
                    
                    // Calculate rolling average (last 10 readings)
                    const recentReadings = this.raplData.powerReadings[name].slice(-10);
                    const avgPower = recentReadings.reduce((a, b) => a + b, 0) / recentReadings.length;
                    
                    // Update statistics
                    const stats = this.raplData.stats[name];
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
                this.raplData.previousEnergy[name] = energy;
                this.raplData.previousTime[name] = currentTime;
            }
        } catch (error) {
            // Silently handle errors - RAPL data is optional
        }
        
        return raplPower;
    }

    updateStatsJS(key, value) {
        if (value === null || value === undefined || isNaN(value)) {
            return;
        }
        
        // Additional validation for power values - only track reasonable values
        if (key.includes('power') && (value < 0 || value > 1000)) {
            return;
        }
        
        if (!this.simpleStats) {
            this.simpleStats = {};
        }
        
        if (!this.simpleStats[key]) {
            this.simpleStats[key] = {
                min: value,
                max: value,
                sum: value,
                count: 1,
                current: value,
                validCount: 1  // Track only valid readings
            };
        } else {
            this.simpleStats[key].min = Math.min(this.simpleStats[key].min, value);
            this.simpleStats[key].max = Math.max(this.simpleStats[key].max, value);
            this.simpleStats[key].sum += value;
            this.simpleStats[key].count++;
            this.simpleStats[key].current = value;
            this.simpleStats[key].validCount++;
        }
    }

    getStatsJS() {
        // Use the main.js simpleStats object
        const result = {};
        for (const [key, stat] of Object.entries(this.simpleStats || {})) {
            result[key] = {
                current: stat.current,
                min: stat.min,
                max: stat.max,
                avg: stat.validCount > 0 ? stat.sum / stat.validCount : 0
            };
        }
        return result;
    }
}

module.exports = HybridSystemMonitor;
