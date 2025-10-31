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
  
  // Verify native module is unpacked (should be in resources/app.asar.unpacked)
  // The asarUnpack configuration should handle this, but let's verify
  const resourcesDir = path.join(appOutDir, 'resources');
  const asarUnpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
  const nativeModulePath = path.join(asarUnpackedDir, 'build', 'Release', 'system_monitor.node');
  
  if (fs.existsSync(nativeModulePath)) {
    console.log('✓ Native module found in unpacked directory:', nativeModulePath);
  } else {
    console.warn('⚠ Native module not found at expected location:', nativeModulePath);
    console.warn('  This is expected if native module build failed or npmRebuild=false');
    console.warn('  Application will use JavaScript fallback');
  }
};

