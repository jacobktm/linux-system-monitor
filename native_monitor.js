const systemMonitor = require('./build/Release/system_monitor');

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
