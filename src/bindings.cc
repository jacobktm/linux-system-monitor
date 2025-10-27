#include <nan.h>
#include "system_monitor.h"

using namespace v8;

// Global SystemMonitor instance
SystemMonitor* g_monitor = nullptr;

// Initialize the native addon
NAN_METHOD(Initialize) {
    if (g_monitor == nullptr) {
        g_monitor = new SystemMonitor();
    }
    info.GetReturnValue().Set(Nan::New<Boolean>(true));
}

// Get CPU cores data
NAN_METHOD(GetCPUCores) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    std::vector<CoreData> cores = g_monitor->getCPUCores();
    Local<Array> result = Nan::New<Array>(cores.size());
    
    for (size_t i = 0; i < cores.size(); i++) {
        Local<Object> core = Nan::New<Object>();
        Nan::Set(core, Nan::New("load").ToLocalChecked(), Nan::New<Number>(cores[i].load));
        Nan::Set(core, Nan::New("frequency").ToLocalChecked(), Nan::New<Number>(cores[i].frequency));
        Nan::Set(core, Nan::New("temperature").ToLocalChecked(), Nan::New<Number>(cores[i].temperature));
        Nan::Set(result, i, core);
    }
    
    info.GetReturnValue().Set(result);
}

// Get temperature sensors
NAN_METHOD(GetTemperatureSensors) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    std::vector<SensorData> sensors = g_monitor->getTemperatureSensors();
    Local<Array> result = Nan::New<Array>(sensors.size());
    
    for (size_t i = 0; i < sensors.size(); i++) {
        Local<Object> sensor = Nan::New<Object>();
        Nan::Set(sensor, Nan::New("name").ToLocalChecked(), Nan::New<String>(sensors[i].name).ToLocalChecked());
        Nan::Set(sensor, Nan::New("label").ToLocalChecked(), Nan::New<String>(sensors[i].label).ToLocalChecked());
        Nan::Set(sensor, Nan::New("value").ToLocalChecked(), Nan::New<Number>(sensors[i].value));
        Nan::Set(sensor, Nan::New("type").ToLocalChecked(), Nan::New<String>(sensors[i].type).ToLocalChecked());
        Nan::Set(result, i, sensor);
    }
    
    info.GetReturnValue().Set(result);
}

// Get DDR5 temperatures
NAN_METHOD(GetDDR5Temperatures) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    std::vector<SensorData> sensors = g_monitor->getDDR5Temperatures();
    Local<Array> result = Nan::New<Array>(sensors.size());
    
    for (size_t i = 0; i < sensors.size(); i++) {
        Local<Object> sensor = Nan::New<Object>();
        Nan::Set(sensor, Nan::New("name").ToLocalChecked(), Nan::New<String>(sensors[i].name).ToLocalChecked());
        Nan::Set(sensor, Nan::New("label").ToLocalChecked(), Nan::New<String>(sensors[i].label).ToLocalChecked());
        Nan::Set(sensor, Nan::New("value").ToLocalChecked(), Nan::New<Number>(sensors[i].value));
        Nan::Set(sensor, Nan::New("type").ToLocalChecked(), Nan::New<String>(sensors[i].type).ToLocalChecked());
        Nan::Set(result, i, sensor);
    }
    
    info.GetReturnValue().Set(result);
}

// Get RAPL power data
NAN_METHOD(GetRAPLPower) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    std::vector<SensorData> sensors = g_monitor->getRAPLPower();
    Local<Array> result = Nan::New<Array>(sensors.size());
    
    for (size_t i = 0; i < sensors.size(); i++) {
        Local<Object> sensor = Nan::New<Object>();
        Nan::Set(sensor, Nan::New("name").ToLocalChecked(), Nan::New<String>(sensors[i].name).ToLocalChecked());
        Nan::Set(sensor, Nan::New("label").ToLocalChecked(), Nan::New<String>(sensors[i].label).ToLocalChecked());
        Nan::Set(sensor, Nan::New("value").ToLocalChecked(), Nan::New<Number>(sensors[i].value));
        Nan::Set(sensor, Nan::New("type").ToLocalChecked(), Nan::New<String>(sensors[i].type).ToLocalChecked());
        Nan::Set(result, i, sensor);
    }
    
    info.GetReturnValue().Set(result);
}

// Get RAPL power with calculations
NAN_METHOD(GetRAPLPowerCalculated) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    std::vector<PowerData> powerData = g_monitor->getRAPLPowerCalculated();
    Local<Array> result = Nan::New<Array>(powerData.size());
    
    for (size_t i = 0; i < powerData.size(); i++) {
        Local<Object> power = Nan::New<Object>();
        Nan::Set(power, Nan::New("name").ToLocalChecked(), Nan::New<String>(powerData[i].name).ToLocalChecked());
        Nan::Set(power, Nan::New("power").ToLocalChecked(), Nan::New<Number>(powerData[i].power));
        Nan::Set(power, Nan::New("energy").ToLocalChecked(), Nan::New<Number>(powerData[i].energy));
        
        // Stats object
        Local<Object> stats = Nan::New<Object>();
        Nan::Set(stats, Nan::New("current").ToLocalChecked(), Nan::New<Number>(powerData[i].power));
        Nan::Set(stats, Nan::New("min").ToLocalChecked(), Nan::New<Number>(powerData[i].min_power));
        Nan::Set(stats, Nan::New("max").ToLocalChecked(), Nan::New<Number>(powerData[i].max_power));
        Nan::Set(stats, Nan::New("avg").ToLocalChecked(), Nan::New<Number>(powerData[i].avg_power));
        
        Nan::Set(power, Nan::New("stats").ToLocalChecked(), stats);
        Nan::Set(result, i, power);
    }
    
    info.GetReturnValue().Set(result);
}

// Update statistics
NAN_METHOD(UpdateStats) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    if (info.Length() < 2) {
        return Nan::ThrowError("Expected 2 arguments: key and value");
    }
    
    if (!info[0]->IsString() || !info[1]->IsNumber()) {
        return Nan::ThrowError("Expected string key and number value");
    }
    
    std::string key = std::string(*Nan::Utf8String(info[0]));
    double value = info[1]->NumberValue(Nan::GetCurrentContext()).FromJust();
    
    g_monitor->updateStats(key, value);
    info.GetReturnValue().Set(Nan::New<Boolean>(true));
}

// Get statistics
NAN_METHOD(GetStats) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    SystemStats stats = g_monitor->getStats();
    Local<Object> result = Nan::New<Object>();
    
    // Convert stats to JavaScript object in the same format as the JavaScript version
    // Each key should have { current, min, max, avg }
    for (const auto& pair : stats.min_values) {
        const std::string& key = pair.first;
        Local<Object> statObj = Nan::New<Object>();
        
        // Set min value
        Nan::Set(statObj, Nan::New("min").ToLocalChecked(), Nan::New<Number>(pair.second));
        
        // Set max value if it exists
        if (stats.max_values.find(key) != stats.max_values.end()) {
            Nan::Set(statObj, Nan::New("max").ToLocalChecked(), Nan::New<Number>(stats.max_values[key]));
        }
        
        // Set avg value if it exists - use valid_count for accurate average
        if (stats.sum_values.find(key) != stats.sum_values.end() && 
            stats.valid_count_values.find(key) != stats.valid_count_values.end() &&
            stats.valid_count_values[key] > 0) {
            double avg = stats.sum_values[key] / stats.valid_count_values[key];
            Nan::Set(statObj, Nan::New("avg").ToLocalChecked(), Nan::New<Number>(avg));
        }
        
        // Set current value
        if (stats.current_values.find(key) != stats.current_values.end()) {
            Nan::Set(statObj, Nan::New("current").ToLocalChecked(), Nan::New<Number>(stats.current_values[key]));
        }
        
        Nan::Set(result, Nan::New<String>(key).ToLocalChecked(), statObj);
    }
    
    info.GetReturnValue().Set(result);
}

// Reset statistics
NAN_METHOD(ResetStats) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    g_monitor->resetStats();
    info.GetReturnValue().Set(Nan::New<Boolean>(true));
}

// Check if last valid value exists
NAN_METHOD(HasLastValidValue) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    if (info.Length() < 1 || !info[0]->IsString()) {
        return Nan::ThrowError("Expected string key");
    }
    
    std::string key = std::string(*Nan::Utf8String(info[0]));
    bool hasValue = g_monitor->hasLastValidValue(key);
    info.GetReturnValue().Set(Nan::New<Boolean>(hasValue));
}

// Get last valid value
NAN_METHOD(GetLastValidValue) {
    if (g_monitor == nullptr) {
        return Nan::ThrowError("SystemMonitor not initialized");
    }
    
    if (info.Length() < 1 || !info[0]->IsString()) {
        return Nan::ThrowError("Expected string key");
    }
    
    std::string key = std::string(*Nan::Utf8String(info[0]));
    double value = g_monitor->getLastValidValue(key);
    info.GetReturnValue().Set(Nan::New<Number>(value));
}

// Module initialization
NAN_MODULE_INIT(Init) {
    Nan::Set(target, Nan::New("initialize").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(Initialize)).ToLocalChecked());
    Nan::Set(target, Nan::New("getCPUCores").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetCPUCores)).ToLocalChecked());
    Nan::Set(target, Nan::New("getTemperatureSensors").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetTemperatureSensors)).ToLocalChecked());
    Nan::Set(target, Nan::New("getDDR5Temperatures").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetDDR5Temperatures)).ToLocalChecked());
    Nan::Set(target, Nan::New("getRAPLPower").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetRAPLPower)).ToLocalChecked());
    Nan::Set(target, Nan::New("getRAPLPowerCalculated").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetRAPLPowerCalculated)).ToLocalChecked());
    Nan::Set(target, Nan::New("updateStats").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(UpdateStats)).ToLocalChecked());
    Nan::Set(target, Nan::New("getStats").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetStats)).ToLocalChecked());
    Nan::Set(target, Nan::New("resetStats").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(ResetStats)).ToLocalChecked());
    Nan::Set(target, Nan::New("hasLastValidValue").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(HasLastValidValue)).ToLocalChecked());
    Nan::Set(target, Nan::New("getLastValidValue").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetLastValidValue)).ToLocalChecked());
}

NODE_MODULE(system_monitor, Init)
