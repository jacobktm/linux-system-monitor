const si = require('systeminformation');
const fs = require('fs');

class HybridSystemMonitor {
    constructor() {
        this.nativeMonitor = null;
        this.useNative = false;
        this.init();
    }

    init() {
        try {
            const NativeSystemMonitor = require('./native_monitor');
            this.nativeMonitor = new NativeSystemMonitor();
            if (this.nativeMonitor.isInitialized()) {
                this.useNative = true;
                console.log('Using native system monitor for improved performance');
            } else {
                console.log('Native monitor not available, using JavaScript fallback');
            }
        } catch (error) {
            console.log('Native monitor not available, using JavaScript fallback:', error.message);
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
        if (this.useNative) {
            try {
                const sensors = this.nativeMonitor.getRAPLPower();
                const raplPower = {};
                sensors.forEach(sensor => {
                    raplPower[sensor.name] = {
                        power: 0, // Will be calculated from energy delta
                        energy: sensor.value,
                        stats: {
                            current: 0,
                            min: 0,
                            max: 0,
                            avg: 0
                        }
                    };
                });
                return raplPower;
            } catch (error) {
                console.warn('Native RAPL power failed, falling back to JavaScript:', error.message);
                this.useNative = false;
            }
        }
        
        // JavaScript fallback - use existing function
        return await this.getIntelRAPLPowerJS();
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
        const raplPower = {};
        
        try {
            if (!fs.existsSync('/sys/class/powercap/intel-rapl')) {
                return raplPower;
            }

            const raplDirs = fs.readdirSync('/sys/class/powercap/intel-rapl').filter(d => d.startsWith('intel-rapl:'));

            for (const raplDir of raplDirs) {
                const basePath = `/sys/class/powercap/intel-rapl/${raplDir}`;
                const name = this.readSensorFile(`${basePath}/name`);
                const energyStr = this.readSensorFile(`${basePath}/energy_uj`);

                if (name && energyStr) {
                    raplPower[name] = {
                        power: 0,
                        energy: parseInt(energyStr) / 1000000,
                        stats: {
                            current: 0,
                            min: 0,
                            max: 0,
                            avg: 0
                        }
                    };
                }
            }
        } catch (error) {
            // Silently handle errors - RAPL data is optional
        }

        return raplPower;
    }

    updateStatsJS(key, value) {
        // This would be the existing updateSimpleStat logic
        // For now, do nothing as placeholder
    }

    getStatsJS() {
        // This would be the existing getSimpleStats logic
        // For now, return empty object as placeholder
        return {};
    }
}

module.exports = HybridSystemMonitor;
