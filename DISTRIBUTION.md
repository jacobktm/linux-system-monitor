# Distribution Guide

This guide explains how to create self-contained, distributable versions of Linux System Monitor that don't require clients to install Node.js, npm, or build anything.

## Building Distributables

### Prerequisites

Make sure you have all dependencies installed:

```bash
./setup.sh
```

Or manually:
```bash
npm install
npm run build:native  # Rebuild native module for Electron's ABI
```

### Creating Distributables

#### Build AppImage and .deb packages:

```bash
npm run dist:linux
```

This will create:
- **AppImage**: `dist/Linux-System-Monitor-1.0.0-x64.AppImage`
  - Standalone executable, no installation needed
  - Just make it executable: `chmod +x Linux-System-Monitor-*.AppImage && ./Linux-System-Monitor-*.AppImage`

- **Debian Package**: `dist/Linux-System-Monitor-1.0.0-x64.deb`
  - Can be installed with: `sudo dpkg -i Linux-System-Monitor-*.deb`

#### Build for testing (unpacked directory):

```bash
npm run pack
```

This creates an unpacked version in `dist/linux-unpacked/` for testing without creating installers.

### Distribution Features

✅ **Self-contained**: No Node.js or npm installation required  
✅ **Native module included**: Pre-built for Electron's ABI  
✅ **All dependencies bundled**: Everything needed to run  
✅ **Portable**: AppImage can run from anywhere  
✅ **No compilation needed**: Clients just download and run  

### Technical Details

- Electron Builder automatically:
  - Rebuilds the native C++ module for Electron's ABI
  - Bundles all Node.js dependencies
  - Creates appropriate Linux packages
  - Includes all application files

- The native module (`system_monitor.node`) is:
  - Built for Electron's specific ABI version
  - Included in the packaged application
  - Loaded automatically at runtime

### File Structure in Package

The packaged app includes:
- All JavaScript files (`main.js`, `renderer.js`, etc.)
- All dependencies (`node_modules/`)
- Native module (`build/Release/system_monitor.node`)
- Electron runtime
- Application resources

### Troubleshooting

**Native module not working in packaged app:**
- Make sure to run `npm run build:native` before packaging
- Check that `electron-rebuild` completed successfully
- Verify the module exists at `build/Release/system_monitor.node`

**AppImage won't run:**
- Make it executable: `chmod +x *.AppImage`
- Check for missing system libraries: `ldd <AppImage>` or use `strace`
- Some distributions may need `fuse` installed

**Debian package installation fails:**
- Check dependencies: `dpkg -I *.deb`
- Install missing dependencies first
- Try: `sudo apt-get install -f` to fix dependency issues

### Distribution Size

Expected sizes:
- AppImage: ~150-200 MB
- Debian package: ~150-200 MB
- Unpacked directory: ~300-400 MB

Size includes:
- Electron runtime (~100 MB)
- Node.js dependencies
- Native module
- Application code

