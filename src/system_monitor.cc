#include "system_monitor.h"
#include <nan.h>
#include <fstream>
#include <sstream>
#include <dirent.h>
#include <unistd.h>
#include <sys/stat.h>
#include <algorithm>

SystemMonitor::SystemMonitor() {
    // Initialize statistics
    stats_ = SystemStats();
}

SystemMonitor::~SystemMonitor() {
    // Cleanup if needed
}

std::string SystemMonitor::readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        return "";
    }
    
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

std::vector<std::string> SystemMonitor::readDirectory(const std::string& path) {
    std::vector<std::string> files;
    DIR* dir = opendir(path.c_str());
    if (dir == nullptr) {
        return files;
    }
    
    struct dirent* entry;
    while ((entry = readdir(dir)) != nullptr) {
        if (entry->d_name[0] != '.') {
            files.push_back(std::string(entry->d_name));
        }
    }
    closedir(dir);
    return files;
}

bool SystemMonitor::fileExists(const std::string& path) {
    struct stat buffer;
    return (stat(path.c_str(), &buffer) == 0);
}

std::vector<CoreData> SystemMonitor::getCPUCores() {
    std::vector<CoreData> cores;
    
    // Read CPU frequencies from /sys/devices/system/cpu/
    std::vector<std::string> cpuDirs = readDirectory("/sys/devices/system/cpu/");
    
    for (const auto& dir : cpuDirs) {
        if (dir.find("cpu") == 0 && dir != "cpufreq" && dir != "cpuidle") {
            std::string cpuPath = "/sys/devices/system/cpu/" + dir;
            std::string freqPath = cpuPath + "/cpufreq/scaling_cur_freq";
            
            if (fileExists(freqPath)) {
                CoreData core;
                std::string freqStr = readFile(freqPath);
                if (!freqStr.empty()) {
                    core.frequency = std::stod(freqStr) / 1000.0; // Convert kHz to MHz
                } else {
                    core.frequency = 0.0;
                }
                core.load = 0.0; // Will be filled by JavaScript
                core.temperature = 0.0; // Will be filled by temperature sensors
                cores.push_back(core);
            }
        }
    }
    
    return cores;
}

std::vector<SensorData> SystemMonitor::getTemperatureSensors() {
    std::vector<SensorData> sensors;
    
    // Read from /sys/class/hwmon
    std::vector<std::string> hwmonDirs = readDirectory("/sys/class/hwmon/");
    
    for (const auto& hwmon : hwmonDirs) {
        if (hwmon.find("hwmon") == 0) {
            std::string basePath = "/sys/class/hwmon/" + hwmon;
            std::string namePath = basePath + "/name";
            std::string name = readFile(namePath);
            
            // Remove newline
            if (!name.empty() && name.back() == '\n') {
                name.pop_back();
            }
            
            // Check for CPU-related sensors
            if (name.find("coretemp") != std::string::npos ||
                name.find("k10temp") != std::string::npos ||
                name.find("zenpower") != std::string::npos ||
                name.find("x86_pkg_temp") != std::string::npos) {
                
                // Read temperature sensors
                for (int i = 1; i <= 30; i++) {
                    std::string tempPath = basePath + "/temp" + std::to_string(i) + "_input";
                    std::string labelPath = basePath + "/temp" + std::to_string(i) + "_label";
                    
                    if (fileExists(tempPath)) {
                        std::string tempStr = readFile(tempPath);
                        std::string label = readFile(labelPath);
                        
                        if (!tempStr.empty()) {
                            SensorData sensor;
                            sensor.name = name;
                            sensor.label = label.empty() ? "temp" + std::to_string(i) : label;
                            if (!sensor.label.empty() && sensor.label.back() == '\n') {
                                sensor.label.pop_back();
                            }
                            sensor.value = std::stod(tempStr) / 1000.0; // Convert millidegrees to degrees
                            sensor.type = "cpu";
                            sensors.push_back(sensor);
                        }
                    }
                }
            }
        }
    }
    
    return sensors;
}

std::vector<SensorData> SystemMonitor::getDDR5Temperatures() {
    std::vector<SensorData> sensors;
    
    // Read from /sys/class/hwmon for spd5118 sensors
    std::vector<std::string> hwmonDirs = readDirectory("/sys/class/hwmon/");
    
    for (const auto& hwmon : hwmonDirs) {
        if (hwmon.find("hwmon") == 0) {
            std::string basePath = "/sys/class/hwmon/" + hwmon;
            std::string namePath = basePath + "/name";
            std::string name = readFile(namePath);
            
            // Remove newline
            if (!name.empty() && name.back() == '\n') {
                name.pop_back();
            }
            
            // Check for spd5118 sensors (DDR5 memory)
            if (name.find("spd5118") != std::string::npos) {
                for (int i = 1; i <= 10; i++) {
                    std::string tempPath = basePath + "/temp" + std::to_string(i) + "_input";
                    std::string labelPath = basePath + "/temp" + std::to_string(i) + "_label";
                    
                    if (fileExists(tempPath)) {
                        std::string tempStr = readFile(tempPath);
                        std::string label = readFile(labelPath);
                        
                        if (!tempStr.empty()) {
                            SensorData sensor;
                            sensor.name = name;
                            sensor.label = label.empty() ? "DDR5_Module_" + std::to_string(i) : label;
                            if (!sensor.label.empty() && sensor.label.back() == '\n') {
                                sensor.label.pop_back();
                            }
                            sensor.value = std::stod(tempStr) / 1000.0; // Convert millidegrees to degrees
                            sensor.type = "ddr5";
                            sensors.push_back(sensor);
                        }
                    }
                }
            }
        }
    }
    
    return sensors;
}

std::vector<SensorData> SystemMonitor::getRAPLPower() {
    std::vector<SensorData> sensors;
    
    // Read from /sys/class/powercap/intel-rapl
    if (!fileExists("/sys/class/powercap/intel-rapl")) {
        return sensors;
    }
    
    std::vector<std::string> raplDirs = readDirectory("/sys/class/powercap/intel-rapl/");
    
    for (const auto& dir : raplDirs) {
        if (dir.find("intel-rapl:") == 0) {
            std::string basePath = "/sys/class/powercap/intel-rapl/" + dir;
            std::string namePath = basePath + "/name";
            std::string energyPath = basePath + "/energy_uj";
            
            if (fileExists(namePath) && fileExists(energyPath)) {
                std::string name = readFile(namePath);
                std::string energyStr = readFile(energyPath);
                
                if (!name.empty() && !energyStr.empty()) {
                    if (name.back() == '\n') name.pop_back();
                    
                    SensorData sensor;
                    sensor.name = name;
                    sensor.label = name;
                    sensor.value = std::stod(energyStr) / 1000000.0; // Convert microjoules to joules
                    sensor.type = "rapl";
                    sensors.push_back(sensor);
                }
            }
        }
    }
    
    return sensors;
}

void SystemMonitor::updateStats(const std::string& key, double value) {
    if (stats_.min_values.find(key) == stats_.min_values.end() || value < stats_.min_values[key]) {
        stats_.min_values[key] = value;
    }
    
    if (stats_.max_values.find(key) == stats_.max_values.end() || value > stats_.max_values[key]) {
        stats_.max_values[key] = value;
    }
    
    stats_.sum_values[key] += value;
    stats_.count_values[key]++;
}

SystemStats SystemMonitor::getStats() {
    return stats_;
}

void SystemMonitor::resetStats() {
    stats_.min_values.clear();
    stats_.max_values.clear();
    stats_.sum_values.clear();
    stats_.count_values.clear();
}
