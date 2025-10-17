# Performance Optimization & 10 Hz Refresh Rate

## Overview
This system monitor now runs at **10 Hz (100ms refresh)** for smooth, real-time monitoring. To achieve this without memory leaks or excessive CPU usage, we use a **tiered caching system**.

## Tiered Caching Strategy

### ⚡ Fast Data (100ms / 10 Hz)
Updated on every refresh cycle for real-time responsiveness:
- **CPU Load**: Per-core utilization, overall load
- **CPU Frequencies**: Current clock speeds per core
- **CPU Temperature**: Main temperature sensor
- **Memory**: RAM usage, swap usage
- **GPU**: Utilization, VRAM usage, temperature, power, clocks (via nvidia-smi)
- **Disk I/O**: Read/write speeds per second
- **Network**: Interface speeds, bytes transferred

### 🔄 Medium Data (1 second)
Updated every 1 second - these change slowly:
- **Battery**: Charge level, charging status, time remaining
- **Fans**: RPM readings
- **Power Sensors**: Consumption metrics
- **Disk Temperatures**: Thermal readings
- **CPU Temperature Sensors**: Additional thermal zones

### 🐌 Slow Data (30-60 seconds)
Updated infrequently - mostly static information:
- **CPU Info**: Brand, cores, base speed (30s)
- **OS Info**: Distro, kernel, hostname (30s)
- **Disk Layout**: Device list, sizes, types (30s)
- **SMART Data**: Health status, wear level, power-on hours (60s)

## Why This Works

### Memory Management
1. **Prevents SMART data flooding**: Running `smartctl` every 100ms would spawn 600 processes per minute per disk
2. **Reduces allocations**: Static data is fetched once and reused
3. **Garbage collection**: Enabled with `--expose-gc` flag, runs every 2 minutes
4. **Buffer limits**: All exec commands have 1MB max buffer and 5s timeout

### CPU Efficiency
- Fast sensors (CPU, GPU, Memory) use direct sysfs reads or nvidia-smi (< 5ms)
- Medium sensors batch together to reduce syscall overhead
- Slow sensors amortize expensive operations over time
- No redundant JSON parsing for static data

### Actual Refresh Rates
At 10 Hz with tiered caching:
- **Fast data**: 10 updates/second (100% responsiveness)
- **Medium data**: 1 update/second (still very smooth)
- **Slow data**: 0.03-0.016 updates/second (perfectly adequate)

## Performance Metrics

### Expected CPU Usage
- **Idle system**: ~2-4% CPU usage
- **Active system**: ~5-8% CPU usage
- **GPU queries**: ~0.5ms per nvidia-smi call
- **Total refresh cycle**: ~10-30ms (well under 100ms budget)

### Memory Usage
- **Base**: ~150-200 MB (Electron)
- **Runtime growth**: < 50 MB over hours
- **Leak prevention**: Caching + periodic GC keeps it stable

## Monitoring the Monitor

### Signs of Good Performance
✅ Smooth animations and updates
✅ Stable memory usage over time
✅ Low CPU overhead (< 5% average)
✅ Responsive to system changes

### Signs of Issues
⚠️ Memory growing continuously
⚠️ CPU usage > 10% consistently
⚠️ Choppy updates or lag
⚠️ Process crashes or freezes

### Debug Mode
Run with dev tools to monitor:
```bash
npm run dev
```

Then check:
- Performance tab: CPU profiles
- Memory tab: Heap snapshots
- Console: Any error messages

## Technical Details

### Cache Invalidation
- **Time-based**: Each cache tier has its own TTL
- **Automatic**: No manual intervention needed
- **Graceful**: Old data served if new fetch fails

### Data Flow
```
100ms tick
  ├─ Check static cache (30s TTL)
  │   └─ Update if expired
  ├─ Check medium cache (1s TTL)
  │   └─ Update if expired
  ├─ Check SMART cache (60s TTL)
  │   └─ Update if expired
  └─ Fetch fast data
      └─ Return combined result
```

### Process Management
- All child processes (smartctl, nvidia-smi) have:
  - 5 second timeout
  - SIGTERM kill signal
  - 1MB buffer limit
  - Proper error handling

## Customization

### Adjust Refresh Rate
Edit `renderer.js`:
```javascript
}, 100); // Change to 50 for 20 Hz, 200 for 5 Hz, etc.
```

### Adjust Cache Durations
Edit `main.js`:
```javascript
const SMART_CACHE_DURATION = 60000; // 60 seconds
const STATIC_CACHE_DURATION = 30000; // 30 seconds
const MEDIUM_CACHE_DURATION = 1000; // 1 second
```

### Disable Specific Sensors
Comment out in the Promise.all arrays to skip expensive sensors

## Recommendations

### For Low-End Systems
- Increase MEDIUM_CACHE_DURATION to 2000 (2s)
- Increase refresh to 200ms (5 Hz)
- Disable SMART monitoring if not needed

### For High-End Systems
- Keep at 100ms (10 Hz) - smooth as butter
- Enable all sensors
- Consider 50ms (20 Hz) if you want ultra-smooth

### For Laptops
- Keep at 100ms for responsiveness
- SMART data already cached appropriately
- Battery info updates every 1s (perfect balance)

