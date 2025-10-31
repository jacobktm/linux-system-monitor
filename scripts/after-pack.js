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
  
  // Verify and ensure native module is unpacked correctly
  // electron-builder should unpack it via asarUnpack, but we'll verify and fix if needed
  const resourcesDir = path.join(appOutDir, 'resources');
  const asarUnpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
  const targetNativePath = path.join(asarUnpackedDir, 'build', 'Release', 'system_monitor.node');
  
  // Check if native module exists in source build directory (from npmRebuild)
  const possibleSourcePaths = [
    path.join(appOutDir, 'build', 'Release', 'system_monitor.node'), // If rebuilt in app root
    path.join(asarUnpackedDir, 'build', 'Release', 'system_monitor.node'), // Already unpacked
    path.join(__dirname, '..', 'build', 'Release', 'system_monitor.node') // Source directory
  ];
  
  let nativeModuleSource = null;
  for (const sourcePath of possibleSourcePaths) {
    if (fs.existsSync(sourcePath)) {
      nativeModuleSource = sourcePath;
      console.log('✓ Found native module at:', sourcePath);
      break;
    }
  }
  
  // Ensure it's in the correct unpacked location
  if (nativeModuleSource && nativeModuleSource !== targetNativePath) {
    // Create directory structure if needed
    const targetDir = path.dirname(targetNativePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log('Created directory:', targetDir);
    }
    
    // Copy to unpacked location
    fs.copyFileSync(nativeModuleSource, targetNativePath);
    fs.chmodSync(targetNativePath, 0o755);
    console.log('✓ Copied native module to unpacked location:', targetNativePath);
  } else if (fs.existsSync(targetNativePath)) {
    console.log('✓ Native module already in correct location:', targetNativePath);
  } else {
    console.warn('⚠ Native module not found - checking locations:');
    possibleSourcePaths.forEach(p => {
      const exists = fs.existsSync(p) ? '✓' : '✗';
      console.warn(`  ${exists} ${p}`);
    });
    console.warn('  Application will use JavaScript fallback');
  }
};

