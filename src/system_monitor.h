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

struct PowerData {
    std::string name;
    double power;
    double energy;
    double min_power;
    double max_power;
    double avg_power;
};

struct SystemStats {
    std::map<std::string, double> min_values;
    std::map<std::string, double> max_values;
    std::map<std::string, double> sum_values;
    std::map<std::string, int> count_values;
    std::map<std::string, double> current_values;
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
    std::vector<PowerData> getRAPLPowerCalculated();
    
    // Statistics
    void updateStats(const std::string& key, double value);
    SystemStats getStats();
    void resetStats();
    
private:
    SystemStats stats_;
    
    // RAPL power calculation state
    std::map<std::string, uint64_t> previous_energy_;
    std::map<std::string, uint64_t> previous_time_;
    std::map<std::string, std::vector<double>> power_readings_;
    std::map<std::string, double> min_power_;
    std::map<std::string, double> max_power_;
    std::map<std::string, double> sum_power_;
    std::map<std::string, int> count_power_;
    
    std::string readFile(const std::string& path);
    std::vector<std::string> readDirectory(const std::string& path);
    bool fileExists(const std::string& path);
    uint64_t getCurrentTimeMicroseconds();
};

#endif // SYSTEM_MONITOR_H
