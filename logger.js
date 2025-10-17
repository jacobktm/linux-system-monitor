const fs = require('fs');
const path = require('path');

class SystemLogger {
  constructor() {
    this.isLogging = true;
    this.logDir = path.join(require('os').homedir(), '.system-monitor-logs');
    this.startTime = Date.now();
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    // Stats tracking
    this.stats = {};
    this.lastData = null;
    
    // CSV file streams
    this.detailedLogPath = null;
    this.detailedStream = null;
    this.csvHeader = null;
    
    this.initialize();
  }
  
  initialize() {
    // Create log directory
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Setup detailed log file
    this.detailedLogPath = path.join(this.logDir, `system-monitor-${this.sessionId}.csv`);
    this.detailedStream = fs.createWriteStream(this.detailedLogPath, { flags: 'a' });
    
    console.log(`Logging to: ${this.detailedLogPath}`);
  }
  
  logData(data) {
    if (!this.isLogging || !data) return;
    
    const timestamp = new Date().toISOString();
    
    // Write header if first time (need data to build proper header)
    if (!this.csvHeader) {
      this.lastData = data;  // Set lastData first for header building
      this.csvHeader = this.buildCSVHeader(data);
      this.detailedStream.write(this.csvHeader + '\n');
    }
    
    this.lastData = data;
    const row = this.buildCSVRow(data, timestamp);
    
    // Write data row
    this.detailedStream.write(row + '\n');
    
    // Update statistics
    this.updateStats(data);
  }
  
  buildCSVHeader(data) {
    const headers = ['timestamp', 'runtime_ms'];
    
    // CPU data (only dynamic values)
    if (data && data.cpu) {
      headers.push('cpu_usage'); // Overall CPU usage
      
      // CPU package frequency (average of all cores)
      headers.push('cpu_freq_package');
      
      // CPU package temperature (main temperature)
      if (data.cpu.temperature && data.cpu.temperature.main) {
        headers.push('cpu_temp_package');
      } else if (data.cpu.temperature && data.cpu.temperature.sensors && data.cpu.temperature.sensors.length > 0) {
        // Use first sensor as package temp if no main temp
        headers.push('cpu_temp_package');
      }
      
      // Per-core CPU usage
      if (data.cpu.coreLoads) {
        for (let i = 0; i < data.cpu.coreLoads.length; i++) {
          headers.push(`cpu_core${i}_usage`);
        }
      }
      
      // Per-core CPU frequencies
      if (data.cpu.frequencies) {
        for (let i = 0; i < data.cpu.frequencies.length; i++) {
          headers.push(`cpu_core${i}_freq`);
        }
      }
      
      // CPU temperature sensors (all sensors - package, cores, CCDs)
      if (data.cpu.temperature && data.cpu.temperature.sensors) {
        data.cpu.temperature.sensors.forEach(sensor => {
          const name = sensor.type.replace(/[^a-zA-Z0-9]/g, '_');
          headers.push(`cpu_temp_${name}`);
        });
      }
    }
    
    // Memory data (only dynamic values)
    if (data && data.memory) {
      headers.push('mem_used', 'mem_percent'); // Only dynamic values
      if (data.memory.swap && data.memory.swap.used !== undefined) {
        headers.push('swap_used'); // Only dynamic values
      }
    }
    
    // Disk data
    if (data && data.disk) {
      headers.push('disk_read_total', 'disk_write_total');
      
      // Per-disk I/O
      if (data.disk.perDiskIO) {
        Object.keys(data.disk.perDiskIO).forEach(device => {
          headers.push(`disk_${device}_read`);
          headers.push(`disk_${device}_write`);
        });
      }
      
      // Per-disk temperatures
      if (data.disk.temperatures) {
        Object.keys(data.disk.temperatures).forEach(device => {
          headers.push(`disk_${device}_temp`);
        });
      }
    }
    
    // GPU data
    if (data && data.gpu && data.gpu.length > 0) {
      const gpu = data.gpu[0];
      if (gpu.utilizationGpu !== undefined) headers.push('gpu_usage');
      if (gpu.temperatureGpu !== undefined) headers.push('gpu_temp');
      if (gpu.powerDraw !== undefined) headers.push('gpu_power');
      if (gpu.memoryUsed !== undefined) headers.push('gpu_vram_used');
      if (gpu.memoryTotal !== undefined) headers.push('gpu_vram_total');
    }
    
    // Intel RAPL power data
    if (data && data.raplPower) {
      Object.keys(data.raplPower).forEach(name => {
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
        headers.push(`rapl_${cleanName}_power`);
      });
    }
    
    // Network data
    if (data && data.network) {
      headers.push('network_rx_total', 'network_tx_total');
    }
    
    return headers.join(',');
  }
  
  buildCSVRow(data, timestamp) {
    const values = [timestamp];
    const runtime = Date.now() - this.startTime;
    values.push(runtime);
    
    // CPU data (only dynamic values)
    if (data && data.cpu) {
      values.push(this.formatNumber(data.cpu.currentLoad)); // Overall CPU usage
      
      // CPU package frequency (average of all cores)
      const avgFreq = data.cpu.frequencies && data.cpu.frequencies.length > 0 
        ? data.cpu.frequencies.reduce((a, b) => a + b, 0) / data.cpu.frequencies.length
        : data.cpu.speed || 0;
      values.push(this.formatNumber(avgFreq));
      
      // CPU package temperature (main temperature)
      if (data.cpu.temperature && data.cpu.temperature.main) {
        values.push(this.formatNumber(data.cpu.temperature.main));
      } else if (data.cpu.temperature && data.cpu.temperature.sensors && data.cpu.temperature.sensors.length > 0) {
        // Use first sensor as package temp if no main temp
        values.push(this.formatNumber(data.cpu.temperature.sensors[0].temp));
      }
      
      // Per-core CPU usage
      if (data.cpu.coreLoads) {
        for (let i = 0; i < data.cpu.coreLoads.length; i++) {
          values.push(this.formatNumber(data.cpu.coreLoads[i].load));
        }
      }
      
      // Per-core CPU frequencies
      if (data.cpu.frequencies) {
        for (let i = 0; i < data.cpu.frequencies.length; i++) {
          values.push(this.formatNumber(data.cpu.frequencies[i]));
        }
      }
      
      // CPU temperature sensors (all sensors - package, cores, CCDs)
      if (data.cpu.temperature && data.cpu.temperature.sensors) {
        data.cpu.temperature.sensors.forEach(sensor => {
          values.push(this.formatNumber(sensor.temp));
        });
      }
    }
    
    // Memory data (only dynamic values)
    if (data && data.memory) {
      values.push(data.memory.used || 0);
      values.push(this.formatNumber(data.memory.usedPercent));
      if (data.memory.swap && data.memory.swap.used !== undefined) {
        values.push(data.memory.swap.used || 0);
      }
    }
    
    // Disk data
    if (data && data.disk) {
      values.push(data.disk.io?.rIO || 0);
      values.push(data.disk.io?.wIO || 0);
      
      // Per-disk I/O
      if (data.disk.perDiskIO) {
        Object.keys(data.disk.perDiskIO).forEach(device => {
          const diskIO = data.disk.perDiskIO[device];
          values.push(this.formatNumber(diskIO.readBytesPerSec));
          values.push(this.formatNumber(diskIO.writeBytesPerSec));
        });
      }
      
      // Per-disk temperatures
      if (data.disk.temperatures) {
        Object.keys(data.disk.temperatures).forEach(device => {
          values.push(this.formatNumber(data.disk.temperatures[device]));
        });
      }
    }
    
    // GPU data
    if (data && data.gpu && data.gpu.length > 0) {
      const gpu = data.gpu[0];
      if (gpu.utilizationGpu !== undefined) values.push(this.formatNumber(gpu.utilizationGpu));
      if (gpu.temperatureGpu !== undefined) values.push(this.formatNumber(gpu.temperatureGpu));
      if (gpu.powerDraw !== undefined) values.push(this.formatNumber(gpu.powerDraw));
      if (gpu.memoryUsed !== undefined) values.push(gpu.memoryUsed || 0);
      if (gpu.memoryTotal !== undefined) values.push(gpu.memoryTotal || 0);
    }
    
    // Intel RAPL power data
    if (data && data.raplPower) {
      Object.keys(data.raplPower).forEach(name => {
        const raplData = data.raplPower[name];
        values.push(this.formatNumber(raplData.power));
      });
    }
    
    // Network data
    if (data && data.network) {
      let rxTotal = 0, txTotal = 0;
      data.network.forEach(net => {
        rxTotal += net.rx_bytes || 0;
        txTotal += net.tx_bytes || 0;
      });
      values.push(rxTotal);
      values.push(txTotal);
    }
    
    return values.join(',');
  }
  
  updateStats(data) {
    // CPU stats
    this.updateStat('cpu_usage', data.cpu?.currentLoad);
    
    if (data.cpu?.coreLoads) {
      data.cpu.coreLoads.forEach((core, i) => {
        this.updateStat(`cpu_core${i}_usage`, core.load);
      });
    }
    
    if (data.cpu?.temperature?.sensors) {
      data.cpu.temperature.sensors.forEach(sensor => {
        const name = sensor.type.replace(/[^a-zA-Z0-9]/g, '_');
        this.updateStat(`cpu_temp_${name}`, sensor.temp);
      });
    }
    
    // Memory stats
    this.updateStat('mem_percent', data.memory?.usedPercent);
    
    // GPU stats
    if (data.gpu && data.gpu.length > 0) {
      const gpu = data.gpu[0];
      this.updateStat('gpu_usage', gpu.utilizationGpu);
      this.updateStat('gpu_temp', gpu.temperature);
      this.updateStat('gpu_power', gpu.powerDraw);
      if (gpu.vram && gpu.vramUsed) {
        this.updateStat('gpu_vram_percent', (gpu.vramUsed / gpu.vram) * 100);
      }
    }
    
    // Per-disk I/O rates
    if (data.disk?.perDiskIO) {
      Object.entries(data.disk.perDiskIO).forEach(([device, diskIO]) => {
        this.updateStat(`disk_${device}_read`, diskIO.readBytesPerSec);
        this.updateStat(`disk_${device}_write`, diskIO.writeBytesPerSec);
      });
    }
    
    // Network rates
    if (data.network) {
      data.network.forEach(net => {
        if (net.rx_sec !== null) this.updateStat(`net_${net.iface}_rx`, net.rx_sec);
        if (net.tx_sec !== null) this.updateStat(`net_${net.iface}_tx`, net.tx_sec);
      });
    }
  }
  
  updateStat(key, value) {
    if (value === null || value === undefined || isNaN(value)) return;
    
    if (!this.stats[key]) {
      this.stats[key] = {
        min: value,
        max: value,
        sum: value,
        count: 1,
        current: value
      };
    } else {
      this.stats[key].min = Math.min(this.stats[key].min, value);
      this.stats[key].max = Math.max(this.stats[key].max, value);
      this.stats[key].sum += value;
      this.stats[key].count++;
      this.stats[key].current = value;
    }
  }
  
  getStats() {
    const result = {};
    for (const [key, stat] of Object.entries(this.stats)) {
      result[key] = {
        current: stat.current,
        min: stat.min,
        max: stat.max,
        avg: stat.sum / stat.count
      };
    }
    return result;
  }
  
  writeSummary() {
    const summaryPath = path.join(this.logDir, `summary-${this.sessionId}.csv`);
    const stats = this.getStats();
    
    const lines = ['metric,min,max,avg,current'];
    for (const [key, stat] of Object.entries(stats)) {
      lines.push(`${key},${this.formatNumber(stat.min)},${this.formatNumber(stat.max)},${this.formatNumber(stat.avg)},${this.formatNumber(stat.current)}`);
    }
    
    fs.writeFileSync(summaryPath, lines.join('\n'));
    console.log(`Summary written to: ${summaryPath}`);
    
    return summaryPath;
  }
  
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '';
    return Number(num).toFixed(2);
  }
  
  close() {
    if (this.detailedStream) {
      this.detailedStream.end();
    }
    this.writeSummary();
  }
}

module.exports = SystemLogger;

