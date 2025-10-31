#include <napi.h>
#include "system_monitor.h"
#include <limits>
#include <cmath>

using namespace Napi;

// Global SystemMonitor instance
SystemMonitor* g_monitor = nullptr;

// Initialize the native addon
Value Initialize(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        g_monitor = new SystemMonitor();
    }
    return Boolean::New(env, true);
}

// Get CPU cores data
Value GetCPUCores(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::vector<CoreData> cores = g_monitor->getCPUCores();
    Array result = Array::New(env, cores.size());
    
    for (size_t i = 0; i < cores.size(); i++) {
        Object core = Object::New(env);
        core.Set("load", Number::New(env, cores[i].load));
        core.Set("frequency", Number::New(env, cores[i].frequency));
        core.Set("temperature", Number::New(env, cores[i].temperature));
        result[i] = core;
    }
    
    return result;
}

// Get temperature sensors
Value GetTemperatureSensors(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::vector<SensorData> sensors = g_monitor->getTemperatureSensors();
    Array result = Array::New(env, sensors.size());
    
    for (size_t i = 0; i < sensors.size(); i++) {
        Object sensor = Object::New(env);
        sensor.Set("name", String::New(env, sensors[i].name));
        sensor.Set("label", String::New(env, sensors[i].label));
        sensor.Set("value", Number::New(env, sensors[i].value));
        sensor.Set("type", String::New(env, sensors[i].type));
        result[i] = sensor;
    }
    
    return result;
}

// Get DDR5 temperatures
Value GetDDR5Temperatures(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::vector<SensorData> sensors = g_monitor->getDDR5Temperatures();
    Array result = Array::New(env, sensors.size());
    
    for (size_t i = 0; i < sensors.size(); i++) {
        Object sensor = Object::New(env);
        sensor.Set("name", String::New(env, sensors[i].name));
        sensor.Set("label", String::New(env, sensors[i].label));
        sensor.Set("value", Number::New(env, sensors[i].value));
        sensor.Set("type", String::New(env, sensors[i].type));
        result[i] = sensor;
    }
    
    return result;
}

// Get RAPL power data
Value GetRAPLPower(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::vector<SensorData> sensors = g_monitor->getRAPLPower();
    Array result = Array::New(env, sensors.size());
    
    for (size_t i = 0; i < sensors.size(); i++) {
        Object sensor = Object::New(env);
        sensor.Set("name", String::New(env, sensors[i].name));
        sensor.Set("label", String::New(env, sensors[i].label));
        sensor.Set("value", Number::New(env, sensors[i].value));
        sensor.Set("type", String::New(env, sensors[i].type));
        result[i] = sensor;
    }
    
    return result;
}

// Get RAPL power with calculations
Value GetRAPLPowerCalculated(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::vector<PowerData> powerData = g_monitor->getRAPLPowerCalculated();
    Array result = Array::New(env, powerData.size());
    
    for (size_t i = 0; i < powerData.size(); i++) {
        Object power = Object::New(env);
        power.Set("name", String::New(env, powerData[i].name));
        power.Set("power", Number::New(env, powerData[i].power));
        power.Set("energy", Number::New(env, powerData[i].energy));
        power.Set("totalWh", Number::New(env, powerData[i].total_wh));
        power.Set("totalKWh", Number::New(env, powerData[i].total_kwh));
        
        // Stats object
        Object stats = Object::New(env);
        stats.Set("current", Number::New(env, powerData[i].power));
        stats.Set("min", Number::New(env, powerData[i].min_power));
        stats.Set("max", Number::New(env, powerData[i].max_power));
        stats.Set("avg", Number::New(env, powerData[i].avg_power));
        
        power.Set("stats", stats);
        result[i] = power;
    }
    
    return result;
}

// Get Battery calculated sensors
Value GetBatteryCalculated(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string status;
    bool ac_connected = false;
    double voltage_v = std::numeric_limits<double>::quiet_NaN();
    double current_a = std::numeric_limits<double>::quiet_NaN();
    double power_w = std::numeric_limits<double>::quiet_NaN();
    double energy_now_wh = std::numeric_limits<double>::quiet_NaN();
    double energy_full_wh = std::numeric_limits<double>::quiet_NaN();
    double estimated_hours = std::numeric_limits<double>::quiet_NaN();
    std::string derived_state;

    bool ok = g_monitor->getBatteryCalculated(status, ac_connected, voltage_v, current_a, power_w,
                                              energy_now_wh, energy_full_wh, estimated_hours, derived_state);
    if (!ok) {
        return env.Null();
    }

    Object obj = Object::New(env);
    obj.Set("status", String::New(env, status));
    obj.Set("acConnected", Boolean::New(env, ac_connected));
    
    // Check for NaN using comparison (NaN != NaN is always true)
    if (voltage_v == voltage_v) obj.Set("voltage", Number::New(env, voltage_v));
    if (current_a == current_a) obj.Set("current", Number::New(env, current_a));
    if (power_w == power_w) obj.Set("powerWatts", Number::New(env, power_w));
    if (energy_now_wh == energy_now_wh) obj.Set("energyNowWh", Number::New(env, energy_now_wh));
    if (energy_full_wh == energy_full_wh) obj.Set("energyFullWh", Number::New(env, energy_full_wh));
    if (estimated_hours == estimated_hours) obj.Set("estimatedHours", Number::New(env, estimated_hours));
    
    obj.Set("state", String::New(env, derived_state));
    return obj;
}

// Update statistics
Value UpdateStats(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (info.Length() < 2) {
        Error::New(env, "Expected 2 arguments: key and value").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString() || !info[1].IsNumber()) {
        Error::New(env, "Expected string key and number value").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string key = info[0].As<String>().Utf8Value();
    double value = info[1].As<Number>().DoubleValue();
    
    g_monitor->updateStats(key, value);
    return Boolean::New(env, true);
}

// Get statistics
Value GetStats(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    SystemStats stats = g_monitor->getStats();
    Object result = Object::New(env);
    
    // Convert stats to JavaScript object in the same format as the JavaScript version
    // Each key should have { current, min, max, avg }
    for (const auto& pair : stats.min_values) {
        const std::string& key = pair.first;
        Object statObj = Object::New(env);
        
        // Set min value
        statObj.Set("min", Number::New(env, pair.second));
        
        // Set max value if it exists
        if (stats.max_values.find(key) != stats.max_values.end()) {
            statObj.Set("max", Number::New(env, stats.max_values[key]));
        }
        
        // Set avg value if it exists - use valid_count for accurate average
        if (stats.sum_values.find(key) != stats.sum_values.end() && 
            stats.valid_count_values.find(key) != stats.valid_count_values.end() &&
            stats.valid_count_values[key] > 0) {
            double avg = stats.sum_values[key] / stats.valid_count_values[key];
            statObj.Set("avg", Number::New(env, avg));
        }
        
        // Set current value
        if (stats.current_values.find(key) != stats.current_values.end()) {
            statObj.Set("current", Number::New(env, stats.current_values[key]));
        }
        
        result.Set(key, statObj);
    }
    
    return result;
}

// Reset statistics
Value ResetStats(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    g_monitor->resetStats();
    return Boolean::New(env, true);
}

// Check if last valid value exists
Value HasLastValidValue(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Error::New(env, "Expected string key").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string key = info[0].As<String>().Utf8Value();
    bool hasValue = g_monitor->hasLastValidValue(key);
    return Boolean::New(env, hasValue);
}

// Get last valid value
Value GetLastValidValue(const CallbackInfo& info) {
    Env env = info.Env();
    if (g_monitor == nullptr) {
        Error::New(env, "SystemMonitor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Error::New(env, "Expected string key").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string key = info[0].As<String>().Utf8Value();
    double value = g_monitor->getLastValidValue(key);
    return Number::New(env, value);
}

// Module initialization
Object Init(Env env, Object exports) {
    exports.Set(String::New(env, "initialize"), Function::New(env, Initialize));
    exports.Set(String::New(env, "getCPUCores"), Function::New(env, GetCPUCores));
    exports.Set(String::New(env, "getTemperatureSensors"), Function::New(env, GetTemperatureSensors));
    exports.Set(String::New(env, "getDDR5Temperatures"), Function::New(env, GetDDR5Temperatures));
    exports.Set(String::New(env, "getRAPLPower"), Function::New(env, GetRAPLPower));
    exports.Set(String::New(env, "getRAPLPowerCalculated"), Function::New(env, GetRAPLPowerCalculated));
    exports.Set(String::New(env, "getBatteryCalculated"), Function::New(env, GetBatteryCalculated));
    exports.Set(String::New(env, "updateStats"), Function::New(env, UpdateStats));
    exports.Set(String::New(env, "getStats"), Function::New(env, GetStats));
    exports.Set(String::New(env, "resetStats"), Function::New(env, ResetStats));
    exports.Set(String::New(env, "hasLastValidValue"), Function::New(env, HasLastValidValue));
    exports.Set(String::New(env, "getLastValidValue"), Function::New(env, GetLastValidValue));
    return exports;
}

NODE_API_MODULE(system_monitor, Init)
