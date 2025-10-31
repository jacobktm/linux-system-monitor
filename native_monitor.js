const path = require('path');

// Helper function to get the unpacked directory path
// In packaged apps with ASAR, unpacked files are in app.asar.unpacked
function getUnpackedDir() {
    // If __dirname contains .asar, replace it with .asar.unpacked
    if (__dirname.includes('.asar')) {
        return __dirname.replace('.asar', '.asar.unpacked');
    }
    // Otherwise, __dirname is correct (development mode or already unpacked)
    return __dirname;
}

let systemMonitor;
try {
    // Try to load prebuilt binary matching current Node/Electron ABI
    const abi = process.versions.modules; // e.g., 140 for Electron 39
    const prebuiltPath = path.join(__dirname, `bin/linux-x64-${abi}/system-monitor.node`);
    systemMonitor = require(prebuiltPath);
    console.log(`Loaded native system monitor from prebuilt: ${prebuiltPath}`);
} catch (e1) {
    try {
        // Try in unpacked directory first (for packaged apps)
        const unpackedDir = getUnpackedDir();
        const unpackedPath = path.join(unpackedDir, 'build/Release/system_monitor.node');
        systemMonitor = require(unpackedPath);
        console.log('Loaded native system monitor from unpacked:', unpackedPath);
    } catch (e2) {
        try {
            // Fallback to same directory as script (development mode or if unpacked path didn't work)
            const buildPath = path.join(__dirname, 'build/Release/system_monitor.node');
            systemMonitor = require(buildPath);
            console.log('Loaded native system monitor from build/Release/system_monitor.node');
        } catch (e3) {
            try {
                // Try without .node extension (legacy)
                const unpackedDir = getUnpackedDir();
                const buildPathLegacy = path.join(unpackedDir, 'build/Release/system_monitor');
                systemMonitor = require(buildPathLegacy);
                console.log('Loaded native system monitor from unpacked (legacy path):', buildPathLegacy);
            } catch (e4) {
                try {
                    // Last fallback - same dir without extension
                    const buildPathLegacy = path.join(__dirname, 'build/Release/system_monitor');
                    systemMonitor = require(buildPathLegacy);
                    console.log('Loaded native system monitor from build/Release/system_monitor (legacy)');
                } catch (e5) {
                    console.error('Failed to load native system monitor:');
                    console.error('  Prebuilt:', e1.message);
                    console.error('  Unpacked:', e2.message);
                    console.error('  Local:', e3.message);
                    console.error('  Unpacked legacy:', e4.message);
                    console.error('  Local legacy:', e5.message);
                    throw e5;
                }
            }
        }
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
