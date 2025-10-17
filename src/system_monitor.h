#ifndef SYSTEM_MONITOR_H
#define SYSTEM_MONITOR_H

#include <nan.h>
#include <string>
#include <vector>
#include <map>

// Core data structures
struct CoreData {
    double load;
    double frequency;
    double temperature;
};

struct SensorData {
    std::string name;
    std::string label;
    double value;
    std::string type;
};

struct SystemStats {
    std::map<std::string, double> min_values;
    std::map<std::string, double> max_values;
    std::map<std::string, double> sum_values;
    std::map<std::string, int> count_values;
};

// Main class for system monitoring
class SystemMonitor {
public:
    SystemMonitor();
    ~SystemMonitor();
    
    // Core functions
    std::vector<CoreData> getCPUCores();
    std::vector<SensorData> getTemperatureSensors();
    std::vector<SensorData> getDDR5Temperatures();
    std::vector<SensorData> getRAPLPower();
    
    // Statistics
    void updateStats(const std::string& key, double value);
    SystemStats getStats();
    void resetStats();
    
private:
    SystemStats stats_;
    std::string readFile(const std::string& path);
    std::vector<std::string> readDirectory(const std::string& path);
    bool fileExists(const std::string& path);
};

#endif // SYSTEM_MONITOR_H
