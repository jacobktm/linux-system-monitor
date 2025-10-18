#!/bin/bash

echo "Testing Intel RAPL Power Calculation"
echo "===================================="

# Function to get current time in microseconds
get_time_us() {
    date +%s%6N
}

# Function to read energy value
read_energy() {
    cat /sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj
}

# Function to read name
read_name() {
    cat /sys/class/powercap/intel-rapl/intel-rapl:0/name
}

echo "RAPL Domain: $(read_name)"
echo ""

# First reading
echo "Taking first reading..."
energy1=$(read_energy)
time1=$(get_time_us)
echo "Energy 1: $energy1 μJ"
echo "Time 1: $time1 μs"
echo ""

# Wait 1 second
echo "Waiting 1 second..."
sleep 1

# Second reading
echo "Taking second reading..."
energy2=$(read_energy)
time2=$(get_time_us)
echo "Energy 2: $energy2 μJ"
echo "Time 2: $time2 μs"
echo ""

# Calculate deltas
energy_delta=$((energy2 - energy1))
time_delta=$((time2 - time1))
time_delta_seconds=$(echo "scale=6; $time_delta / 1000000" | bc -l)

echo "Calculations:"
echo "Energy Delta: $energy_delta μJ"
echo "Time Delta: $time_delta μs ($time_delta_seconds seconds)"
echo ""

# Calculate power
if [ $time_delta -gt 0 ]; then
    # Power = Energy Delta (μJ) / Time Delta (seconds)
    # Since energy is in μJ and time is in seconds, we get μJ/s
    # To convert to Watts: μJ/s = μJ/s * (1 J / 1,000,000 μJ) = J/s = W
    power_watts=$(echo "scale=6; $energy_delta / $time_delta_seconds / 1000000" | bc -l)
    echo "Power: $power_watts Watts"
else
    echo "Power: Cannot calculate (time delta is 0)"
fi

echo ""
echo "Alternative calculation (direct):"
# Direct calculation: energy_delta / time_delta (both in micro-units)
if [ $time_delta -gt 0 ]; then
    power_direct=$(echo "scale=6; $energy_delta / $time_delta" | bc -l)
    echo "Power (direct): $power_direct Watts"
fi

echo ""
echo "Energy counter info:"
max_energy=$(cat /sys/class/powercap/intel-rapl/intel-rapl:0/max_energy_range_uj)
echo "Max Energy Range: $max_energy μJ"
echo "Max Energy Range: $(echo "scale=2; $max_energy / 1000000" | bc -l) J"
echo "Max Energy Range: $(echo "scale=2; $max_energy / 1000000 / 3600" | bc -l) Wh"
