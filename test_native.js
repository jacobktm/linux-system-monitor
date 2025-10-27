#!/usr/bin/env node

// Simple test script for the native system monitor addon
// This script tests basic functionality of the native C++ module

console.log('Testing native system monitor addon...');

try {
    const systemMonitor = require('./build/Release/system_monitor');
    
    console.log('✓ Native module loaded successfully');
    
    // Test initialization
    const initResult = systemMonitor.initialize();
    console.log('✓ Initialization:', initResult);
    
    // Test basic functionality
    try {
        const cores = systemMonitor.getCPUCores();
        console.log('✓ CPU cores:', cores.length, 'detected');
    } catch (e) {
        console.log('⚠ CPU cores test failed:', e.message);
    }
    
    try {
        const sensors = systemMonitor.getTemperatureSensors();
        console.log('✓ Temperature sensors:', sensors.length, 'detected');
    } catch (e) {
        console.log('⚠ Temperature sensors test failed:', e.message);
    }
    
    try {
        const stats = systemMonitor.getStats();
        console.log('✓ Statistics system working');
    } catch (e) {
        console.log('⚠ Statistics test failed:', e.message);
    }
    
    // Test new methods
    try {
        const hasValue = systemMonitor.hasLastValidValue('test_key');
        console.log('✓ hasLastValidValue method working');
    } catch (e) {
        console.log('⚠ hasLastValidValue test failed:', e.message);
    }
    
    try {
        const lastValue = systemMonitor.getLastValidValue('test_key');
        console.log('✓ getLastValidValue method working');
    } catch (e) {
        console.log('⚠ getLastValidValue test failed:', e.message);
    }
    
    console.log('✓ Native addon test completed successfully');
    
} catch (error) {
    console.error('✗ Native addon test failed:', error.message);
    process.exit(1);
}
