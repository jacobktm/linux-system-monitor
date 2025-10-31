const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  
  // Only process Linux AppImage builds
  if (packager.platform.name !== 'linux') {
    return;
  }
  
  const appRunPath = path.join(appOutDir, 'AppRun');
  const customAppRunPath = path.join(__dirname, '..', 'AppRun');
  
  // Copy our custom AppRun if it exists
  if (fs.existsSync(customAppRunPath)) {
    console.log('Replacing AppRun with custom privilege elevation wrapper...');
    fs.copyFileSync(customAppRunPath, appRunPath);
    fs.chmodSync(appRunPath, 0o755);
    console.log('Custom AppRun installed successfully');
  }
};

