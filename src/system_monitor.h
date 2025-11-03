#ifndef SYSTEM_MONITOR_H
#define SYSTEM_MONITOR_H

#include <cstdint>
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
    double total_wh;
    double total_kwh;
};

struct SystemStats {
    std::map<std::string, double> min_values;
    std::map<std::string, double> max_values;
    std::map<std::string, double> sum_values;
    std::map<std::string, int> count_values;
    std::map<std::string, int> valid_count_values;  // Track only valid readings
    std::map<std::string, double> current_values;
    std::map<std::string, double> last_valid_values;  // Store last valid values for persistence
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
    // Battery
    // Returns map-like via V8 binding; here return as a simple std::map string->double not needed.
    // We'll expose via bindings directly assembling a JS object from C++ getters.
    bool getBatteryCalculated(
        std::string& status,
        bool& ac_connected,
        double& voltage_v,
        double& current_a,
        double& power_w,
        double& energy_now_wh,
        double& energy_full_wh,
        double& estimated_hours,
        std::string& derived_state
    );
    
    // Statistics
    void updateStats(const std::string& key, double value);
    SystemStats getStats();
    void resetStats();
    bool hasLastValidValue(const std::string& key);
    double getLastValidValue(const std::string& key);
    
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
    std::map<std::string, double> cumulative_energy_wh_;
    
    std::string readFile(const std::string& path);
    std::vector<std::string> readDirectory(const std::string& path);
    bool fileExists(const std::string& path);
    uint64_t getCurrentTimeMicroseconds();
};

#endif // SYSTEM_MONITOR_H
