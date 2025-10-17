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
    
    // Convert stats to JavaScript object
    Local<Object> minValues = Nan::New<Object>();
    Local<Object> maxValues = Nan::New<Object>();
    Local<Object> avgValues = Nan::New<Object>();
    
    for (const auto& pair : stats.min_values) {
        Nan::Set(minValues, Nan::New<String>(pair.first).ToLocalChecked(), Nan::New<Number>(pair.second));
    }
    
    for (const auto& pair : stats.max_values) {
        Nan::Set(maxValues, Nan::New<String>(pair.first).ToLocalChecked(), Nan::New<Number>(pair.second));
    }
    
    for (const auto& pair : stats.sum_values) {
        if (stats.count_values.find(pair.first) != stats.count_values.end()) {
            double avg = pair.second / stats.count_values[pair.first];
            Nan::Set(avgValues, Nan::New<String>(pair.first).ToLocalChecked(), Nan::New<Number>(avg));
        }
    }
    
    Nan::Set(result, Nan::New("min").ToLocalChecked(), minValues);
    Nan::Set(result, Nan::New("max").ToLocalChecked(), maxValues);
    Nan::Set(result, Nan::New("avg").ToLocalChecked(), avgValues);
    
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
    Nan::Set(target, Nan::New("updateStats").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(UpdateStats)).ToLocalChecked());
    Nan::Set(target, Nan::New("getStats").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(GetStats)).ToLocalChecked());
    Nan::Set(target, Nan::New("resetStats").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(ResetStats)).ToLocalChecked());
}

NODE_MODULE(system_monitor, Init)
