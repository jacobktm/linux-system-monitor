let systemMonitor;
try {
    // Try to load prebuilt binary matching current Node/Electron ABI
    const abi = process.versions.modules; // e.g., 118 for Node 18/Electron 28
    const path = `./bin/linux-x64-${abi}/system-monitor.node`;
    systemMonitor = require(path);
    console.log(`Loaded native system monitor from prebuilt: ${path}`);
} catch (e1) {
    try {
        // Fallback to local build
        systemMonitor = require('./build/Release/system_monitor');
        console.log('Loaded native system monitor from build/Release');
    } catch (e2) {
        console.error('Failed to load native system monitor:', e1.message, '|', e2.message);
        throw e2;
    }
}

class NativeSystemMonitor {
    constructor() {
        this.initialized = false;
        this.init();
    }

    init() {
        try {
            systemMonitor.initialize();
            this.initialized = true;
            console.log('Native system monitor initialized successfully');
        } catch (error) {
            console.error('Failed to initialize native system monitor:', error);
            this.initialized = false;
        }
    }

    isInitialized() {
        return this.initialized;
    }

    getCPUCores() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getCPUCores();
    }

    getTemperatureSensors() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getTemperatureSensors();
    }

    getDDR5Temperatures() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getDDR5Temperatures();
    }

    getRAPLPower() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getRAPLPower();
    }

    getRAPLPowerCalculated() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getRAPLPowerCalculated();
    }

    getBatteryCalculated() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getBatteryCalculated();
    }

    updateStats(key, value) {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.updateStats(key, value);
    }

    getStats() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getStats();
    }

    resetStats() {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.resetStats();
    }

    hasLastValidValue(key) {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.hasLastValidValue(key);
    }

    getLastValidValue(key) {
        if (!this.initialized) {
            throw new Error('Native system monitor not initialized');
        }
        return systemMonitor.getLastValidValue(key);
    }
}

module.exports = NativeSystemMonitor;
