const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  
  // Only process Linux AppImage builds
  if (packager.platform.name !== 'linux') {
    return;
  }
  
  // Copy custom AppRun
  const appRunPath = path.join(appOutDir, 'AppRun');
  const customAppRunPath = path.join(__dirname, '..', 'AppRun');
  
  if (fs.existsSync(customAppRunPath)) {
    console.log('Replacing AppRun with custom privilege elevation wrapper...');
    fs.copyFileSync(customAppRunPath, appRunPath);
    fs.chmodSync(appRunPath, 0o755);
    console.log('Custom AppRun installed successfully');
  }
  
  // Verify native module is unpacked
  // electron-builder unpacks it to the app root in unpacked builds
  // In AppImage, it should be in resources/app.asar.unpacked/build/Release/
  const resourcesDir = path.join(appOutDir, 'resources');
  const asarUnpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
  
  // Check multiple possible locations
  const possiblePaths = [
    path.join(asarUnpackedDir, 'build', 'Release', 'system_monitor.node'),
    path.join(appOutDir, 'build', 'Release', 'system_monitor.node'),
    path.join(appOutDir, 'resources', 'app', 'build', 'Release', 'system_monitor.node')
  ];
  
  let found = false;
  for (const nativeModulePath of possiblePaths) {
    if (fs.existsSync(nativeModulePath)) {
      console.log('✓ Native module found:', nativeModulePath);
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.warn('⚠ Native module not found at expected locations:');
    possiblePaths.forEach(p => console.warn('    ', p));
    console.warn('  This is expected if native module build failed or npmRebuild=false');
    console.warn('  Application will use JavaScript fallback');
  }
};

