#!/bin/bash

# Linux System Monitor - Distribution Build Script
# Builds AppImage and Debian package for distribution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        print_error "npm not found. Please install Node.js and npm first."
        exit 1
    fi
    
    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found. Installing dependencies..."
        npm install
    fi
    
    if [ ! -d "node_modules/electron-builder" ]; then
        print_warning "electron-builder not found. Installing..."
        npm install --save-dev electron-builder
    fi
    
    print_success "Prerequisites check passed"
}

# Function to rebuild native module for Electron
rebuild_native() {
    print_status "Rebuilding native module for Electron..."
    
    # Check if native module exists first
    if [ ! -f "build/Release/system_monitor.node" ]; then
        print_warning "Native module not found. Building initial version..."
        npm run build
    fi
    
    # Note: electron-builder will automatically rebuild native modules during packaging
    # via npmRebuild: true. This manual step is optional but can catch issues early.
    # We'll attempt it but not fail if it doesn't work.
    print_status "Attempting manual rebuild (electron-builder will also rebuild during packaging)..."
    
    # Try rebuild, but don't fail if it doesn't work
    if npm run build:native > /tmp/native-build.log 2>&1; then
        if grep -q "Rebuild Complete" /tmp/native-build.log || [ -f "build/Release/system_monitor.node" ]; then
            print_success "Native module rebuilt successfully for Electron"
        else
            print_warning "Manual rebuild completed but verification uncertain"
            print_status "Note: electron-builder will rebuild during packaging anyway"
        fi
    else
        # Check if it's the known module-dir issue
        if grep -q "paths\[0\].*undefined" /tmp/native-build.log; then
            print_warning "Manual rebuild failed (known @electron/rebuild issue with module-dir)"
            print_status "This is OK - electron-builder will automatically rebuild during packaging"
        else
            print_warning "Native module rebuild failed - see /tmp/native-build.log for details"
            print_status "Continuing - electron-builder will rebuild during packaging via npmRebuild: true"
        fi
    fi
}

# Function to clean previous builds
clean_builds() {
    if [ -d "dist" ]; then
        print_status "Cleaning previous builds..."
        rm -rf dist/*
        print_success "Previous builds cleaned"
    fi
}

# Function to build packages
build_packages() {
    print_status "Building AppImage and Debian package..."
    echo
    
    if npm run dist:linux; then
        print_success "Build completed successfully!"
        echo
        
        # List created packages
        print_status "Created packages:"
        if [ -f "dist/linux-system-monitor-"*.AppImage ]; then
            ls -lh dist/linux-system-monitor-*.AppImage 2>/dev/null | awk '{print "  • AppImage: " $9 " (" $5 ")"}'
        fi
        if [ -f "dist/linux-system-monitor-"*.deb ]; then
            ls -lh dist/linux-system-monitor-*.deb 2>/dev/null | awk '{print "  • Debian:   " $9 " (" $5 ")"}'
        fi
        echo
        
        print_success "Packages are ready in the dist/ directory"
        print_status "You can now distribute these packages to users"
    else
        print_error "Build failed!"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Linux System Monitor - Distribution Build Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -c, --clean     Clean previous builds before building"
    echo "  -n, --no-native Skip native module rebuild"
    echo "  -v, --verbose   Enable verbose output"
    echo
    echo "Examples:"
    echo "  $0              # Build packages (default)"
    echo "  $0 --clean      # Clean and rebuild"
    echo "  $0 --no-native  # Skip native rebuild (faster, but may not work correctly)"
}

# Main function
main() {
    local clean_first=false
    local skip_native=false
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--clean)
                clean_first=true
                shift
                ;;
            -n|--no-native)
                skip_native=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                set -x
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "=========================================="
    echo "  Linux System Monitor - Build Distribution"
    echo "=========================================="
    echo
    
    # Check prerequisites
    check_prerequisites
    
    # Clean if requested
    if [ "$clean_first" = true ]; then
        clean_builds
    fi
    
    # Rebuild native module unless skipped
    if [ "$skip_native" = false ]; then
        rebuild_native
    else
        print_warning "Skipping native module rebuild"
    fi
    
    echo
    
    # Build packages
    build_packages
    
    echo "=========================================="
    echo "  Build Complete!"
    echo "=========================================="
}

# Run main function
main "$@"

