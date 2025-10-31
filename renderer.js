// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Format stat with min/max/avg
function formatStat(current, stats, key, suffix = '%', decimals = 1) {
  if (!stats || !stats[key]) {
    console.log(`📊 FORMAT: No stats for ${key}, returning plain value`);
    return `<span class="current-value">${current.toFixed(decimals)}${suffix}</span>`;
  }
  const stat = stats[key];
  console.log(`📊 FORMAT: ${key} = ${current.toFixed(decimals)}${suffix} [${stat.min.toFixed(decimals)}/${stat.max.toFixed(decimals)}/${stat.avg.toFixed(decimals)}]`);
  return `<span class="current-value">${current.toFixed(decimals)}${suffix}</span><span class="stat-range" title="Min/Max/Avg">[${stat.min.toFixed(decimals)} / ${stat.max.toFixed(decimals)} / ${stat.avg.toFixed(decimals)}]</span>`;
}

// Format time to human-readable format
function formatTime(seconds) {
  if (!seconds || seconds < 0) return 'N/A';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Get temperature class for styling
function getTempClass(temp) {
  if (temp < 60) return 'normal';
  if (temp < 80) return 'warm';
  return 'hot';
}

// Update CPU information
function updateCPU(data) {
  const cpu = data.cpu;
  const stats = data.stats || {};
  
  // Check if elements exist
  const cpuNameEl = document.getElementById('cpu-name');
  if (!cpuNameEl) {
    console.error('❌ DOM: cpu-name element not found!');
    return;
  }
  
  // Update CPU name
  cpuNameEl.textContent = cpu.brand;
  
  // Update overall CPU metrics with stats
  document.getElementById('cpu-usage').innerHTML = formatStat(cpu.currentLoad, stats, 'cpu_usage', '%');
  
  const avgFreq = cpu.frequencies.length > 0 
    ? (cpu.frequencies.reduce((a, b) => a + b, 0) / cpu.frequencies.length)
    : cpu.speed;
  document.getElementById('cpu-freq').innerHTML = formatStat(avgFreq, stats, 'cpu_avg_freq', ' MHz', 0);
  
  // Update CPU power (Intel RAPL) - show last valid value when current data unavailable
  const cpuPowerElement = document.getElementById('cpu-power');
  const powerMetric = document.querySelector('.cpu-card .metric:has(#cpu-power)');
  const cpuEnergyMetric = document.getElementById('cpu-energy-metric');
  const cpuEnergyElement = document.getElementById('cpu-energy');
  
  if (data.raplPower && (data.raplPower['package-0'] || data.raplPower['core'])) {
    // Show the power metric when we have valid RAPL data
    if (powerMetric) powerMetric.style.display = '';
    if (cpuEnergyMetric) cpuEnergyMetric.style.display = '';
    
    if (data.raplPower['package-0']) {
      const packagePower = data.raplPower['package-0'].power;
      const powerKey = 'rapl_package_0_power';
      cpuPowerElement.innerHTML = formatStat(packagePower, stats, powerKey, ' W', 1);
      // Store the last valid value for fallback
      cpuPowerElement.dataset.lastValidValue = packagePower;
      const kwh = data.raplPower['package-0'].totalKWh;
      if (kwh !== undefined && kwh !== null) {
        cpuEnergyElement.textContent = `${kwh.toFixed(4)} kWh`;
      }
    } else if (data.raplPower['core']) {
      // Fallback to core power if package power not available
      const corePower = data.raplPower['core'].power;
      const powerKey = 'rapl_core_power';
      cpuPowerElement.innerHTML = formatStat(corePower, stats, powerKey, ' W', 1);
      // Store the last valid value for fallback
      cpuPowerElement.dataset.lastValidValue = corePower;
      const kwh = data.raplPower['core'].totalKWh;
      if (kwh !== undefined && kwh !== null) {
        cpuEnergyElement.textContent = `${kwh.toFixed(4)} kWh`;
      }
    }
  } else {
    // Show last valid value if available, otherwise hide the metric
    const lastValidValue = cpuPowerElement.dataset.lastValidValue;
    if (lastValidValue && parseFloat(lastValidValue) > 0) {
      // Show the metric with last valid value
      if (powerMetric) powerMetric.style.display = '';
      cpuPowerElement.innerHTML = `<span class="current-value">${parseFloat(lastValidValue).toFixed(1)} W</span><span class="stat-range" style="opacity: 0.7;">[Last valid]</span>`;
      if (cpuEnergyMetric) cpuEnergyMetric.style.display = 'none';
    } else {
      // Hide the power metric completely when no valid data is available
      if (powerMetric) powerMetric.style.display = 'none';
      if (cpuEnergyMetric) cpuEnergyMetric.style.display = 'none';
    }
  }
  
  
  // Update progress bar
  document.getElementById('cpu-progress').style.width = `${cpu.currentLoad}%`;
  
  // Update per-core information
  const coresContainer = document.getElementById('cpu-cores');
  coresContainer.innerHTML = '';
  
  cpu.coreLoads.forEach((core, index) => {
    const coreDiv = document.createElement('div');
    coreDiv.className = 'core-item';
    
    const freq = cpu.frequencies[index] || cpu.speed;
    
    // Add stats for core load and frequency
    const coreLoadKey = `cpu_core${index}_usage`;
    const coreFreqKey = `cpu_core${index}_freq`;
    const coreLoadText = formatStat(core.load, stats, coreLoadKey, '%', 1);
    const coreFreqText = formatStat(freq, stats, coreFreqKey, ' MHz', 0);
    
    // Create the HTML structure with proper separation
    const coreLoadValue = core.load.toFixed(1) + '%';
    const coreFreqValue = freq + ' MHz';
    
    const coreLoadStats = stats && stats[coreLoadKey] ? 
      `<span class="stat-range">[${stats[coreLoadKey].min.toFixed(1)} / ${stats[coreLoadKey].max.toFixed(1)} / ${stats[coreLoadKey].avg.toFixed(1)}]</span>` : '';
    
    const coreFreqStats = stats && stats[coreFreqKey] ? 
      `<span class="stat-range">[${stats[coreFreqKey].min.toFixed(1)} / ${stats[coreFreqKey].max.toFixed(1)} / ${stats[coreFreqKey].avg.toFixed(1)}]</span>` : '';

    coreDiv.innerHTML = `
      <div class="core-name">Core ${index}</div>
      <div class="core-load">${coreLoadValue}${coreLoadStats}</div>
      <div class="core-freq">${coreFreqValue}${coreFreqStats}</div>
    `;
    
    coresContainer.appendChild(coreDiv);
  });
  
  // Update CPU temperature sensors (show ALL sensors - package, CCDs, cores)
  const tempsContainer = document.getElementById('cpu-temps');
  if (cpu.temperature.sensors && cpu.temperature.sensors.length > 0) {
    tempsContainer.innerHTML = '<h3 style="font-size: 0.95em; margin-bottom: 10px; margin-top: 15px; color: #b0b0b0;">CPU Temperature Sensors</h3>';
    
    // Show all CPU temperature sensors
    // AMD: Tctl (package), Tccd1, Tccd2, etc (per-CCD)
    // Intel: Package, Core 0, Core 1, etc (per-core)
    cpu.temperature.sensors.forEach(sensor => {
      const tempDiv = document.createElement('div');
      tempDiv.className = `temp-item ${getTempClass(sensor.temp)}`;
      
      // Get stats for this sensor
      const sensorKey = `cpu_temp_${sensor.type.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const tempText = formatStat(sensor.temp, stats, sensorKey, '°C');
      
      tempDiv.innerHTML = `
        <span class="temp-label">${sensor.type}</span>
        <span class="temp-value">${tempText}</span>
      `;
      tempsContainer.appendChild(tempDiv);
    });
  } else {
    tempsContainer.innerHTML = '';
  }
}

// Update Memory information
function updateMemory(data) {
  const mem = data.memory;
  const stats = data.stats || {};
  
  document.getElementById('mem-usage').innerHTML = formatStat(mem.usedPercent, stats, 'mem_percent', '%');
  document.getElementById('mem-used').textContent = formatBytes(mem.used);
  document.getElementById('mem-total').textContent = formatBytes(mem.total);
  document.getElementById('mem-progress').style.width = `${mem.usedPercent}%`;
  
  document.getElementById('swap-used').textContent = formatBytes(mem.swapUsed);
  document.getElementById('swap-total').textContent = formatBytes(mem.swapTotal);
  
  // Update DDR5 memory temperatures
  const ddr5Container = document.getElementById('ddr5-temps');
  const ddr5Content = document.getElementById('ddr5-temps-content');
  
  if (mem.ddr5Temps && mem.ddr5Temps.length > 0) {
    // Show the DDR5 temperature section
    ddr5Container.style.display = 'block';
    
    // Clear previous content
    ddr5Content.innerHTML = '';
    
    // Add each DDR5 module temperature
    mem.ddr5Temps.forEach((memTemp, index) => {
      const tempDiv = document.createElement('div');
      tempDiv.className = 'ddr5-temp-item';
      tempDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; padding: 5px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);';
      
      const tempKey = `ddr5_module_${index}_temp`;
      const tempValue = formatStat(memTemp.temp, stats, tempKey, '°C', 1);
      
      tempDiv.innerHTML = `
        <span style="font-size: 0.9em; color: #aaa;">${memTemp.label}</span>
        <span style="font-size: 0.9em; color: #fff;">${tempValue}</span>
      `;
      
      ddr5Content.appendChild(tempDiv);
    });
  } else {
    // Hide the DDR5 temperature section if no DDR5 modules detected
    ddr5Container.style.display = 'none';
  }
}

// Update GPU information
function updateGPU(data) {
  const gpuContainer = document.getElementById('gpu-info');
  const gpuCard = document.querySelector('.gpu-card');
  
  // Filter out GPUs with no meaningful data
  const validGPUs = data.gpu ? data.gpu.filter(gpu => 
    gpu && (gpu.utilizationGpu !== null || gpu.temperatureGpu !== null || gpu.vram)
  ) : [];
  
  if (validGPUs.length === 0) {
    gpuCard.style.display = 'none';
    return;
  }
  
  gpuCard.style.display = 'block';
  
  gpuContainer.innerHTML = '';
  const stats = data.stats || {};
  
  validGPUs.forEach((gpu, index) => {
    const gpuDiv = document.createElement('div');
    gpuDiv.className = 'gpu-item';
    
    // VRAM information
    let vramInfo = '';
    if (gpu.vram && gpu.vramUsed !== null && gpu.vramUsed !== undefined) {
      const vramUsedGB = (gpu.vramUsed / 1024).toFixed(1);
      const vramTotalGB = (gpu.vram / 1024).toFixed(1);
      const vramPercent = ((gpu.vramUsed / gpu.vram) * 100).toFixed(1);
      const vramStats = stats['gpu_vram_percent'] ? 
        ` <span class="stat-range" title="Min/Max/Avg">[${(stats['gpu_vram_percent'].min).toFixed(1)}% / ${(stats['gpu_vram_percent'].max).toFixed(1)}% / ${(stats['gpu_vram_percent'].avg).toFixed(1)}%]</span>` : '';
      vramInfo = `${vramUsedGB} / ${vramTotalGB} GB (${vramPercent}%)${vramStats}`;
    } else if (gpu.vram) {
      vramInfo = `${(gpu.vram / 1024).toFixed(1)} GB`;
    }
    
    let metricsHTML = '';
    
    // Usage metrics - always show GPU Usage, even if 0 or null/undefined
    const gpuUsageValue = (gpu.utilizationGpu !== null && gpu.utilizationGpu !== undefined) 
      ? formatStat(gpu.utilizationGpu, stats, 'gpu_usage', '%')
      : formatStat(0, stats, 'gpu_usage', '%');
    const gpuTempText = (gpu.temperatureGpu !== null && gpu.temperatureGpu !== undefined) 
      ? formatStat(gpu.temperatureGpu, stats, 'gpu_temp', '°C') 
      : '';
    
    metricsHTML += `
      <div class="metric-row">
        <div class="metric">
          <span class="label">GPU Usage</span>
          <span class="value">${gpuUsageValue}</span>
        </div>
        ${(gpu.temperatureGpu !== null && gpu.temperatureGpu !== undefined) ? `
          <div class="metric">
            <span class="label">Temperature</span>
            <span class="value ${getTempClass(gpu.temperatureGpu)}">${gpuTempText}</span>
          </div>
        ` : ''}
      </div>
    `;
    
    // VRAM and Fan
    if (vramInfo || gpu.fanSpeed !== null) {
      metricsHTML += `
        <div class="metric-row">
          ${vramInfo ? `
            <div class="metric">
              <span class="label">VRAM Usage</span>
              <span class="value">${vramInfo}</span>
            </div>
          ` : ''}
          ${gpu.fanSpeed !== null ? `
            <div class="metric">
              <span class="label">Fan Speed</span>
              <span class="value">${gpu.fanSpeed}%</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Power metrics
    if ((gpu.powerDraw !== null && gpu.powerDraw !== undefined) || (gpu.powerLimit !== null && gpu.powerLimit !== undefined)) {
      const powerText = (gpu.powerDraw !== null && gpu.powerDraw !== undefined) ? formatStat(gpu.powerDraw, stats, 'gpu_power', 'W') : '';
      const energyText = (gpu.energyKWh !== null && gpu.energyKWh !== undefined)
        ? `${gpu.energyKWh.toFixed(4)} kWh`
        : '';
      
      metricsHTML += `
        <div class="metric-row">
          ${(gpu.powerDraw !== null && gpu.powerDraw !== undefined) ? `
            <div class="metric">
              <span class="label">Power Draw</span>
              <span class="value">${powerText}</span>
            </div>
          ` : ''}
          ${(gpu.powerLimit !== null && gpu.powerLimit !== undefined) ? `
            <div class="metric">
              <span class="label">Power Limit</span>
              <span class="value">${gpu.powerLimit.toFixed(0)}W</span>
            </div>
          ` : ''}
          ${energyText ? `
            <div class="metric">
              <span class="label">Energy</span>
              <span class="value">${energyText}</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Clock speeds
    if (gpu.clockCore !== null || gpu.clockMemory !== null) {
      metricsHTML += `
        <div class="metric-row">
          ${gpu.clockCore !== null ? `
            <div class="metric">
              <span class="label">Core Clock</span>
              <span class="value">${gpu.clockCore} MHz</span>
            </div>
          ` : ''}
          ${gpu.clockMemory !== null ? `
            <div class="metric">
              <span class="label">Memory Clock</span>
              <span class="value">${gpu.clockMemory} MHz</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    gpuDiv.innerHTML = `
      <div class="gpu-name">${gpu.model || 'Unknown GPU'}</div>
      <div class="info-label">${gpu.vendor || ''}</div>
      ${metricsHTML}
    `;
    
    gpuContainer.appendChild(gpuDiv);
  });
}

// Update Disk information
function updateDisk(data) {
  const disk = data.disk;
  const stats = data.stats || {};
  
  // Update disk list with SMART data, I/O, and temperature
  const diskList = document.getElementById('disk-list');
  if (disk.layout && disk.layout.length > 0) {
    diskList.innerHTML = '';
    
    disk.layout.forEach(d => {
      const diskDiv = document.createElement('div');
      diskDiv.className = 'disk-item';
      
      // Extract device name (e.g., 'sda' from '/dev/sda')
      const deviceName = d.device ? d.device.replace('/dev/', '') : '';
      const smartData = disk.smart && disk.smart[deviceName];
      const diskIO = disk.perDiskIO && disk.perDiskIO[deviceName];
      
      // Find temperature for this disk (diskTemps is now an object keyed by device name)
      let diskTemp = null;
      if (disk.temperatures && disk.temperatures[deviceName] !== undefined) {
        diskTemp = disk.temperatures[deviceName];
      }
      // Also check SMART temp as fallback
      if (!diskTemp && smartData && smartData.temperature) {
        diskTemp = smartData.temperature;
      }
      
      // Build info line with temperature and SMART data
      let infoHTML = '';
      const infoParts = [];
      
      if (smartData) {
        const healthIcon = smartData.healthy ? '✓' : '⚠️';
        const healthColor = smartData.healthy ? '#4caf50' : '#f44336';
        infoParts.push(`<span style="color: ${healthColor}; font-weight: bold;">${healthIcon} ${smartData.healthy ? 'Healthy' : 'Warning'}</span>`);
      }
      
      if (diskTemp) {
        const tempClass = getTempClass(diskTemp);
        const tempColor = tempClass === 'hot' ? '#f44336' : tempClass === 'warm' ? '#ff9800' : '#4caf50';
        const tempStats = formatStat(diskTemp, stats, `disk_${deviceName}_temp`, '°C');
        infoParts.push(`<span style="color: ${tempColor};">🌡️ ${tempStats}</span>`);
      }
      
      if (smartData && smartData.powerOnHours) {
        infoParts.push(`${Math.floor(smartData.powerOnHours / 24)} days`);
      }
      
      if (smartData && smartData.wearLevel) {
        infoParts.push(`${smartData.wearLevel}% life`);
      }
      
      if (infoParts.length > 0) {
        infoHTML = `
          <div style="margin-top: 8px; font-size: 0.85em; color: #b0b0b0;">
            ${infoParts.join(' • ')}
          </div>
        `;
      }
      
      // Always show I/O stats (even if 0) so it doesn't flash on/off
      let ioHTML = '';
      if (diskIO) {
        const readSpeed = diskIO.readBytesPerSec || 0;
        const writeSpeed = diskIO.writeBytesPerSec || 0;
        const readStr = readSpeed === 0 ? '0 B/s' : formatBytes(readSpeed) + '/s';
        const writeStr = writeSpeed === 0 ? '0 B/s' : formatBytes(writeSpeed) + '/s';
        
        // Add stats if available
        const readKey = `disk_${deviceName}_read`;
        const writeKey = `disk_${deviceName}_write`;
        let readStatsHTML = '';
        let writeStatsHTML = '';
        
        if (stats[readKey]) {
          readStatsHTML = ` <span class="stat-range" style="font-size: 0.7em;" title="Min/Max/Avg">[${formatBytes(stats[readKey].min)}/s / ${formatBytes(stats[readKey].max)}/s / ${formatBytes(stats[readKey].avg)}/s]</span>`;
        }
        if (stats[writeKey]) {
          writeStatsHTML = ` <span class="stat-range" style="font-size: 0.7em;" title="Min/Max/Avg">[${formatBytes(stats[writeKey].min)}/s / ${formatBytes(stats[writeKey].max)}/s / ${formatBytes(stats[writeKey].avg)}/s]</span>`;
        }
        
        ioHTML = `
          <div style="margin-top: 8px; font-size: 0.85em;">
            <div><span style="color: #4fc3f7;">↓ ${readStr}</span>${readStatsHTML}</div>
            <div style="margin-top: 2px;"><span style="color: #ff9800;">↑ ${writeStr}</span>${writeStatsHTML}</div>
          </div>
        `;
      }
      
      diskDiv.innerHTML = `
        <div class="disk-name">${d.name || d.device}</div>
        <div class="disk-details">${d.type} • ${formatBytes(d.size)}</div>
        ${ioHTML}
        ${infoHTML}
      `;
      diskList.appendChild(diskDiv);
    });
  } else {
    diskList.innerHTML = '';
  }
  
  // No longer needed - disk temps are shown with each disk now
  const diskTemps = document.getElementById('disk-temps');
  diskTemps.innerHTML = '';
}

// Update System Temperatures information
function updateSystemTemps(data) {
  const tempsContainer = document.getElementById('system-temps-info');
  const tempsCard = document.querySelector('.temps-card');
  
  if (!data.systemTemps || data.systemTemps.length === 0) {
    tempsCard.style.display = 'none';
    return;
  }
  
  tempsCard.style.display = 'block';
  tempsContainer.innerHTML = '';
  
  data.systemTemps.forEach(sensor => {
    const tempDiv = document.createElement('div');
    tempDiv.className = `temp-item ${getTempClass(sensor.temp)}`;
    tempDiv.innerHTML = `
      <span class="temp-label">${sensor.type}</span>
      <span class="temp-value">${sensor.temp.toFixed(1)}°C</span>
    `;
    tempsContainer.appendChild(tempDiv);
  });
}

// Update Fans information
function updateFans(data) {
  const fansContainer = document.getElementById('fans-info');
  const fansCard = document.querySelector('.fans-card');
  
  // Filter out fans with 0 RPM or invalid data
  const validFans = data.fans ? data.fans.filter(fan => fan && fan.speed > 0) : [];
  
  if (validFans.length === 0) {
    fansCard.style.display = 'none';
    return;
  }
  
  fansCard.style.display = 'block';
  
  fansContainer.innerHTML = '';
  
  const stats = data.stats || {};
  
  validFans.forEach((fan, index) => {
    const fanDiv = document.createElement('div');
    fanDiv.className = 'fan-item';
    const fanSpeedText = formatStat(fan.speed, stats, `fan_${index}_speed`, ' RPM', 0);
    fanDiv.innerHTML = `
      <span class="fan-label">${fan.label}</span>
      <span class="fan-value">${fanSpeedText}</span>
    `;
    fansContainer.appendChild(fanDiv);
  });
}

// Update Power information
function updatePower(data) {
  const powerContainer = document.getElementById('power-info');
  const powerCard = document.querySelector('.power-card');
  
  if (!data.power || data.power.length === 0) {
    powerCard.style.display = 'none';
    return;
  }
  
  powerCard.style.display = 'block';
  
  powerContainer.innerHTML = '';
  
  data.power.forEach(power => {
    const powerDiv = document.createElement('div');
    powerDiv.className = 'power-item';
    powerDiv.innerHTML = `
      <span class="power-label">${power.label}</span>
      <span class="power-value">${power.watts.toFixed(2)} W</span>
    `;
    powerContainer.appendChild(powerDiv);
  });
}

// Update Battery information
function updateBattery(data) {
  const batteryContainer = document.getElementById('battery-info');
  const batteryCard = document.querySelector('.battery-card');
  
  if (!data.battery.hasBattery) {
    batteryCard.style.display = 'none';
    return;
  }
  
  batteryCard.style.display = 'block';
  
  const battery = data.battery;
  const state = battery.state || (battery.isCharging ? 'charging' : 'discharging');
  const chargingStatus = state === 'charging'
    ? '<span class="charging-indicator">⚡ Charging</span>' 
    : (state === 'full' || state === 'idle')
      ? '<span class="charging-indicator">✔ Plugged in</span>'
      : '<span class="discharging-indicator">🔋 Discharging</span>';
  
  const timeRemaining = battery.timeRemaining > 0 
    ? `<div class="metric">
         <span class="label">Time Remaining</span>
         <span class="value">${formatTime(battery.timeRemaining * 60)}</span>
       </div>`
    : '';
  
  const voltage = battery.voltage 
    ? `<div class="metric">
         <span class="label">Voltage</span>
         <span class="value">${battery.voltage.toFixed(2)} V</span>
       </div>`
    : '';
  const stats = data.stats || {};
  const currentMetric = (battery.current !== null && battery.current !== undefined)
    ? `<div class="metric">
         <span class="label">Current</span>
         <span class="value">${formatStat(battery.current, stats, 'battery_current', ' A', 2)}</span>
       </div>`
    : '';
  const powerMetric = (battery.powerWatts !== null && battery.powerWatts !== undefined)
    ? `<div class="metric">
         <span class="label">Power</span>
         <span class="value">${formatStat(battery.powerWatts, stats, 'battery_power', ' W', 2)}</span>
       </div>`
    : '';
  
  const temperature = battery.temperature 
    ? `<div class="metric">
         <span class="label">Temperature</span>
         <span class="value">${battery.temperature.toFixed(1)}°C</span>
       </div>`
    : '';
  
  const capacity = battery.currentCapacity && battery.maxCapacity
    ? `<div class="metric">
         <span class="label">Capacity</span>
         <span class="value">${battery.currentCapacity} / ${battery.maxCapacity} ${battery.capacityUnit || 'mAh'}</span>
       </div>`
    : '';
  
  const estimated = (battery.estimatedHours && battery.estimatedHours > 0)
    ? `<div class="metric">
         <span class="label">Estimated ${state === 'charging' ? 'to Full' : 'Remaining'}</span>
         <span class="value">${formatTime(Math.round(battery.estimatedHours * 3600))}</span>
       </div>`
    : timeRemaining;

  batteryContainer.innerHTML = `
    <div class="battery-status">
      <div class="battery-icon">${battery.percent > 80 ? '🔋' : battery.percent > 50 ? '🔋' : battery.percent > 20 ? '🪫' : '🪫'}</div>
      <div class="battery-details">
        <div style="font-size: 1.5em; font-weight: bold; color: #fff;">${battery.percent}%</div>
        <div style="color: #b0b0b0;">${battery.model || 'Battery'} ${chargingStatus}</div>
      </div>
    </div>
    ${capacity ? `
      <div class="metric-row capacity-only" style="margin-top: 15px;">
        ${capacity}
      </div>
    ` : ''}
    <div class="progress-bar" style="margin-top: ${capacity ? '10px' : '15px'};">
      <div class="progress-fill" style="width: ${battery.percent}%; background: ${battery.isCharging ? 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'}"></div>
    </div>
    <div class="metric-row" style="margin-top: 15px;">
      ${estimated}
      ${voltage}
    </div>
    <div class="metric-row">
      ${currentMetric}
      ${powerMetric}
      ${temperature}
    </div>
    ${battery.cycleCount ? `
      <div class="metric-row">
        <div class="metric">
          <span class="label">Cycle Count</span>
          <span class="value">${battery.cycleCount}</span>
        </div>
      </div>
    ` : ''}
  `;
}

// Update Network information
function updateNetwork(data) {
  const networkContainer = document.getElementById('network-info');
  
  if (!data.network || data.network.length === 0) {
    networkContainer.innerHTML = '<div class="no-data">No network interfaces detected</div>';
    return;
  }
  
  networkContainer.innerHTML = '';
  
  data.network.forEach(net => {
    if (net.operstate === 'up' || net.iface === 'lo') {
      const networkDiv = document.createElement('div');
      networkDiv.className = 'network-item';
      
      const status = net.operstate === 'up' ? '🟢' : '🔴';
      
      networkDiv.innerHTML = `
        <div>
          <div class="network-label">${status} ${net.iface}</div>
          <div style="font-size: 0.8em; color: #666; margin-top: 3px;">
            ↓ ${formatBytes(net.rx_bytes)} | ↑ ${formatBytes(net.tx_bytes)}
          </div>
        </div>
        <div class="network-value">
          <div>↓ ${formatBytes(net.rx_sec)}/s</div>
          <div>↑ ${formatBytes(net.tx_sec)}/s</div>
        </div>
      `;
      
      networkContainer.appendChild(networkDiv);
    }
  });
}

// Update system information
function updateSystemInfo(data) {
  const systemInfo = document.getElementById('system-info');
  const uptime = formatTime(data.system.uptime);
  systemInfo.textContent = `${data.system.distro} ${data.system.release} • Kernel ${data.system.kernel} • Uptime: ${uptime}`;
}

// Throttle IPC calls to prevent overwhelming the main process
let isUpdating = false;
let firstUpdateComplete = false;

// Update all system data
async function updateSystemData() {
  if (isUpdating) {
    return; // Skip if already updating
  }
  
  isUpdating = true;
  try {
    const data = await window.electron.getSystemData();
    console.log('🖥️ RENDERER: Received data, stats count:', data.stats ? Object.keys(data.stats).length : 0);
    
    // Hide loading overlay after first successful update
    if (!firstUpdateComplete) {
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        console.log('✅ Hiding loading overlay');
        loadingOverlay.style.display = 'none';
        console.log('✅ Loading overlay display:', window.getComputedStyle(loadingOverlay).display);
      } else {
        console.warn('⚠️ Loading overlay not found when trying to hide');
      }
      
      // Verify container is visible
      const container = document.querySelector('.container');
      if (container) {
        const containerStyle = window.getComputedStyle(container);
        console.log('✅ Container display:', containerStyle.display);
        console.log('✅ Container visibility:', containerStyle.visibility);
        console.log('✅ Container opacity:', containerStyle.opacity);
      }
      
      firstUpdateComplete = true;
      console.log('✅ First data update complete, UI should now be visible');
    }
    
    // Stats are being received and processed
    
    try {
      updateCPU(data);
      updateMemory(data);
      updateGPU(data);
      updateDisk(data);
      updateSystemTemps(data);
      updateFans(data);
      updatePower(data);
      updateBattery(data);
      updateNetwork(data);
      updateSystemInfo(data);
    } catch (updateError) {
      console.error('❌ Error in update functions:', updateError);
      console.error('❌ Error stack:', updateError.stack);
    }
    
    // Update timestamp and stats status
    const now = new Date();
    const statsStatus = data.stats && Object.keys(data.stats).length > 0 ? 
      ` • Stats: ${Object.keys(data.stats).length} metrics` : 
      ' • No stats';
    document.getElementById('update-time').textContent = `Last update: ${now.toLocaleTimeString()}${statsStatus}`;
  } catch (error) {
    console.error('Error updating system data:', error);
  } finally {
    isUpdating = false;
  }
}

// Track update count for periodic cleanup
let updateCount = 0;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Update loading status
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  
  if (loadingStatus) {
    loadingStatus.textContent = 'Checking IPC bridge...';
  }
  
  // Check if IPC bridge is available
  if (!window.electron || !window.electron.getSystemData) {
    console.error('❌ Electron IPC bridge not available!');
    if (loadingStatus) {
      loadingStatus.innerHTML = `
        <div style="color: #f44336; margin-top: 20px;">
          <strong>⚠️ Error: IPC Bridge Not Available</strong><br>
          Please restart the application.
        </div>
      `;
    }
    return;
  }
  
  if (loadingStatus) {
    loadingStatus.textContent = 'Loading system data...';
  }
  
  // Initial update
  updateSystemData().catch(err => {
    console.error('Error on initial data load:', err);
    if (loadingStatus) {
      loadingStatus.innerHTML = `<div style="color: #f44336; margin-top: 20px;">Error loading data: ${err.message}</div>`;
    }
  });
  
  // Update every 100ms for 10 Hz refresh rate (high-performance monitoring)
  setInterval(() => {
    updateSystemData();
    updateCount++;
    
    // Hint for cleanup every 600 updates (~1 minute at 10 Hz)
    if (updateCount >= 600) {
      updateCount = 0;
      // Let browser handle its own memory management
    }
  }, 100); // 100ms = 10 Hz
});

