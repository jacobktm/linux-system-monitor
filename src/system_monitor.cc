#include "system_monitor.h"
#include <nan.h>
#include <fstream>
#include <sstream>
#include <dirent.h>
#include <unistd.h>
#include <sys/stat.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>
#include <cstdio>

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

std::vector<PowerData> SystemMonitor::getRAPLPowerCalculated() {
    std::vector<PowerData> powerData;
    
    // Read from /sys/class/powercap/intel-rapl
    if (!fileExists("/sys/class/powercap/intel-rapl")) {
        return powerData;
    }
    
    std::vector<std::string> raplDirs = readDirectory("/sys/class/powercap/intel-rapl/");
    uint64_t currentTime = getCurrentTimeMicroseconds();
    
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
                    
                    uint64_t energy = std::stoull(energyStr);
                    
                    // Initialize if first time
                    if (previous_energy_.find(name) == previous_energy_.end()) {
                        previous_energy_[name] = energy;
                        previous_time_[name] = currentTime;
                        power_readings_[name] = std::vector<double>();
                        min_power_[name] = 0.0;
                        max_power_[name] = 0.0;
                        sum_power_[name] = 0.0;
                        count_power_[name] = 0;
                        continue;
                    }
                    
                    // Calculate power
                    uint64_t timeDelta = currentTime - previous_time_[name];
                    uint64_t energyDelta = energy - previous_energy_[name];
                    
                    // Handle energy counter overflow (32-bit counter wraps around at ~2^32)
                    const uint64_t MAX_ENERGY = 1ULL << 32;
                    if (energyDelta > MAX_ENERGY / 2) {
                        energyDelta = energy + (MAX_ENERGY - previous_energy_[name]);
                    }
                    
                    double powerWatts = 0.0;
                    if (timeDelta > 0) {
                        // Convert microjoules to watts: (μJ / μs) / 1,000,000 = J/s = W
                        powerWatts = (double)energyDelta / (double)timeDelta / 1000000.0;
                    }
                    
                    // Filter reasonable values
                    if (timeDelta > 100000 && timeDelta < 10000000 && // 0.1-10 seconds
                        powerWatts >= 0.0 && powerWatts < 1000.0) {
                        
                        // Store reading
                        power_readings_[name].push_back(powerWatts);
                        if (power_readings_[name].size() > 100) {
                            power_readings_[name].erase(power_readings_[name].begin());
                        }
                        
                        // Calculate rolling average (last 10 readings)
                        double avgPower = 0.0;
                        int count = std::min(10, (int)power_readings_[name].size());
                        for (int i = std::max(0, (int)power_readings_[name].size() - count); 
                             i < (int)power_readings_[name].size(); i++) {
                            avgPower += power_readings_[name][i];
                        }
                        avgPower /= count;
                        
                        // Update statistics
                        if (min_power_[name] == 0.0 || avgPower < min_power_[name]) {
                            min_power_[name] = avgPower;
                        }
                        if (avgPower > max_power_[name]) {
                            max_power_[name] = avgPower;
                        }
                        sum_power_[name] += avgPower;
                        count_power_[name]++;
                        
                        // Accumulate session energy in Wh: μJ -> Wh = μJ / 3.6e9
                        double whDelta = (double)energyDelta / 3600000000.0;
                        cumulative_energy_wh_[name] += whDelta;

                        PowerData power;
                        power.name = name;
                        power.power = avgPower;
                        power.energy = (double)energy / 1000000.0; // Convert to joules
                        power.min_power = min_power_[name];
                        power.max_power = max_power_[name];
                        power.avg_power = sum_power_[name] / count_power_[name];
                        power.total_wh = cumulative_energy_wh_[name];
                        power.total_kwh = cumulative_energy_wh_[name] / 1000.0;
                        powerData.push_back(power);
                    }
                    
                    // Update previous values
                    previous_energy_[name] = energy;
                    previous_time_[name] = currentTime;
                }
            }
        }
    }
    
    return powerData;
}

uint64_t SystemMonitor::getCurrentTimeMicroseconds() {
    auto now = std::chrono::high_resolution_clock::now();
    auto duration = now.time_since_epoch();
    return std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
}

bool SystemMonitor::getBatteryCalculated(
    std::string& status,
    bool& ac_connected,
    double& voltage_v,
    double& current_a,
    double& power_w,
    double& energy_now_wh,
    double& energy_full_wh,
    double& estimated_hours,
    std::string& derived_state
) {
    const std::string baseDir = "/sys/class/power_supply";
    if (!fileExists(baseDir)) return false;
    auto entries = readDirectory(baseDir);
    std::string batName;
    std::string acName;
    for (const auto& e : entries) {
        std::string lower = e;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
        if (batName.empty() && lower.rfind("bat", 0) == 0) batName = e;
        if (acName.empty() && (lower.rfind("ac", 0) == 0 || lower.find("ac") != std::string::npos)) acName = e;
    }
    if (batName.empty()) return false;
    std::string bp = baseDir + "/" + batName;

    auto readTrim = [&](const std::string& p) -> std::string {
        std::string s = readFile(p);
        if (!s.empty() && (s.back() == '\n' || s.back() == '\r')) s.erase(std::remove(s.begin(), s.end(), '\n'), s.end());
        return s;
    };

    status = readTrim(bp + "/status");
    if (!acName.empty()) {
        std::string present = readTrim(baseDir + "/" + acName + "/online");
        ac_connected = (present == "1");
    } else {
        ac_connected = false;
    }

    auto toDoubleOr = [&](const std::string& s, double div) -> double {
        if (s.empty()) return std::numeric_limits<double>::quiet_NaN();
        try { return std::stod(s) / div; } catch (...) { return std::numeric_limits<double>::quiet_NaN(); }
    };

    std::string power_now = readTrim(bp + "/power_now"); // microwatts
    std::string current_now = readTrim(bp + "/current_now"); // microamps
    std::string voltage_now = readTrim(bp + "/voltage_now"); // microvolts
    std::string energy_now = readTrim(bp + "/energy_now"); // microwatt-hours
    std::string energy_full = readTrim(bp + "/energy_full"); // microwatt-hours
    std::string charge_now = readTrim(bp + "/charge_now"); // microamp-hours
    std::string charge_full = readTrim(bp + "/charge_full"); // microamp-hours

    voltage_v = toDoubleOr(voltage_now, 1'000'000.0);
    current_a = toDoubleOr(current_now, 1'000'000.0);
    power_w = toDoubleOr(power_now, 1'000'000.0);
    if (std::isnan(power_w) && !std::isnan(voltage_v) && !std::isnan(current_a)) {
        power_w = voltage_v * current_a;
    }
    // Normalize signs: charging currents can be negative in some drivers
    if (!std::isnan(current_a) && current_a < 0.0) current_a = std::fabs(current_a);
    if (!std::isnan(power_w) && power_w < 0.0) power_w = std::fabs(power_w);

    energy_now_wh = toDoubleOr(energy_now, 1'000'000.0);
    energy_full_wh = toDoubleOr(energy_full, 1'000'000.0);
    if ((std::isnan(energy_now_wh) || std::isnan(energy_full_wh)) && !std::isnan(voltage_v)) {
        double charge_now_ah = toDoubleOr(charge_now, 1'000'000.0);
        double charge_full_ah = toDoubleOr(charge_full, 1'000'000.0);
        if (!std::isnan(charge_now_ah)) energy_now_wh = charge_now_ah * voltage_v;
        if (!std::isnan(charge_full_ah)) energy_full_wh = charge_full_ah * voltage_v;
    }

    estimated_hours = std::numeric_limits<double>::quiet_NaN();
    std::string statusLower = status;
    std::transform(statusLower.begin(), statusLower.end(), statusLower.begin(), ::tolower);
    if (!std::isnan(power_w) && power_w > 0.0 && !std::isnan(energy_now_wh)) {
        if (statusLower.find("discharging") != std::string::npos) {
            estimated_hours = energy_now_wh / power_w;
        } else if (statusLower.find("charging") != std::string::npos && !std::isnan(energy_full_wh)) {
            double delta = std::max(energy_full_wh - energy_now_wh, 0.0);
            if (power_w > 0.0) estimated_hours = delta / power_w;
        }
    }

    if (statusLower.find("charging") != std::string::npos) derived_state = "charging";
    else if (statusLower.find("discharging") != std::string::npos) derived_state = "discharging";
    else if (statusLower.find("full") != std::string::npos) derived_state = "full";
    else if (statusLower.find("not charging") != std::string::npos) derived_state = ac_connected ? "idle" : "discharging";
    else derived_state = ac_connected ? "idle" : "discharging";

    // If plugged in and no valid readings, default to zeros rather than missing
    if (ac_connected && (derived_state == "charging" || derived_state == "idle" || derived_state == "full")) {
        if (std::isnan(power_w)) power_w = 0.0;
        if (std::isnan(current_a)) current_a = 0.0;
    }

    return true;
}

void SystemMonitor::updateStats(const std::string& key, double value) {
    // Validate value - skip invalid values
    if (value != value || value == std::numeric_limits<double>::infinity() || value == -std::numeric_limits<double>::infinity()) {
        return;
    }
    
    // Additional validation for power values
    if (key.find("power") != std::string::npos && (value < 0.0 || value > 1000.0)) {
        return;
    }
    
    // Update statistics only for valid values
    if (stats_.min_values.find(key) == stats_.min_values.end() || value < stats_.min_values[key]) {
        stats_.min_values[key] = value;
    }
    
    if (stats_.max_values.find(key) == stats_.max_values.end() || value > stats_.max_values[key]) {
        stats_.max_values[key] = value;
    }
    
    stats_.sum_values[key] += value;
    stats_.count_values[key]++;
    stats_.valid_count_values[key]++;  // Track valid readings separately
    stats_.current_values[key] = value;
    stats_.last_valid_values[key] = value;  // Store as last valid value
}

SystemStats SystemMonitor::getStats() {
    return stats_;
}

void SystemMonitor::resetStats() {
    stats_.min_values.clear();
    stats_.max_values.clear();
    stats_.sum_values.clear();
    stats_.count_values.clear();
    stats_.valid_count_values.clear();
    stats_.current_values.clear();
    stats_.last_valid_values.clear();
}

bool SystemMonitor::hasLastValidValue(const std::string& key) {
    return stats_.last_valid_values.find(key) != stats_.last_valid_values.end();
}

double SystemMonitor::getLastValidValue(const std::string& key) {
    auto it = stats_.last_valid_values.find(key);
    if (it != stats_.last_valid_values.end()) {
        return it->second;
    }
    return 0.0;
}
