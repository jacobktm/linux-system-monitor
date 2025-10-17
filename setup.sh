#!/bin/bash

# Linux System Monitor Setup Script
# This script installs dependencies and prepares the environment for the Linux System Monitor

set -e  # Exit on any error

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        # Handle Pop!_OS as Ubuntu
        if [ "$ID" = "pop" ]; then
            echo "ubuntu"
        else
            echo $ID
        fi
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

# Function to install Node.js if not present
install_nodejs() {
    local distro=$1
    
    print_status "Installing Node.js..."
    
    case $distro in
        "ubuntu"|"debian")
            if ! command_exists node; then
                print_status "Adding NodeSource repository..."
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
            else
                print_success "Node.js is already installed: $(node --version)"
            fi
            ;;
        "fedora"|"rhel"|"centos")
            if ! command_exists node; then
                sudo dnf install -y nodejs npm
            else
                print_success "Node.js is already installed: $(node --version)"
            fi
            ;;
        "arch"|"manjaro")
            if ! command_exists node; then
                sudo pacman -S --noconfirm nodejs npm
            else
                print_success "Node.js is already installed: $(node --version)"
            fi
            ;;
        *)
            print_warning "Unknown distribution. Please install Node.js manually."
            print_warning "Visit: https://nodejs.org/en/download/package-manager/"
            return 1
            ;;
    esac
}

# Function to install system dependencies
install_system_deps() {
    local distro=$1
    
    print_status "Installing system dependencies..."
    
    case $distro in
        "ubuntu"|"debian")
            sudo apt-get update
            sudo apt-get install -y \
                lm-sensors \
                smartmontools \
                curl \
                build-essential \
                python3 \
                python3-pip
            ;;
        "fedora"|"rhel"|"centos")
            sudo dnf install -y \
                lm_sensors \
                smartmontools \
                curl \
                gcc-c++ \
                make \
                python3 \
                python3-pip
            ;;
        "arch"|"manjaro")
            sudo pacman -S --noconfirm \
                lm_sensors \
                smartmontools \
                curl \
                base-devel \
                python \
                python-pip
            ;;
        *)
            print_warning "Unknown distribution. Please install the following packages manually:"
            print_warning "- lm-sensors (or lm_sensors)"
            print_warning "- smartmontools"
            print_warning "- curl"
            print_warning "- build tools (gcc, make, etc.)"
            ;;
    esac
}

# Function to configure sensors
configure_sensors() {
    print_status "Configuring hardware sensors..."
    
    if command_exists sensors-detect; then
        print_status "Running sensors-detect (this may require user interaction)..."
        print_warning "You may need to answer 'yes' to some prompts during sensor detection."
        sudo sensors-detect --auto
    else
        print_warning "sensors-detect not found. Sensor configuration skipped."
    fi
}

# Function to check GPU drivers
check_gpu_drivers() {
    print_status "Checking GPU drivers..."
    
    # Check for NVIDIA
    if command_exists nvidia-smi; then
        print_success "NVIDIA drivers detected: $(nvidia-smi --query-gpu=name --format=csv,noheader,nounits | head -1)"
    else
        print_warning "NVIDIA drivers not detected. Install nvidia-driver for GPU monitoring."
    fi
    
    # Check for AMD GPU
    if [ -d "/sys/class/drm" ]; then
        amd_gpus=$(ls /sys/class/drm | grep -c "card[0-9]" || true)
        if [ "$amd_gpus" -gt 0 ]; then
            print_success "AMD GPU detected in /sys/class/drm"
        fi
    fi
}

# Function to install npm dependencies
install_npm_deps() {
    print_status "Installing npm dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        print_warning "node_modules directory exists. Removing it for clean install..."
        rm -rf node_modules
    fi
    
    # Install dependencies
    npm install
    
    print_success "npm dependencies installed successfully"
}

# Function to verify installation
verify_installation() {
    print_status "Verifying installation..."
    
    # Check Node.js version
    if command_exists node; then
        node_version=$(node --version)
        print_success "Node.js: $node_version"
    else
        print_error "Node.js not found"
        return 1
    fi
    
    # Check npm version
    if command_exists npm; then
        npm_version=$(npm --version)
        print_success "npm: $npm_version"
    else
        print_error "npm not found"
        return 1
    fi
    
    # Check if dependencies are installed
    if [ -d "node_modules" ]; then
        print_success "npm dependencies installed"
    else
        print_error "npm dependencies not found"
        return 1
    fi
    
    # Check for Electron
    if [ -f "node_modules/.bin/electron" ]; then
        print_success "Electron installed"
    else
        print_error "Electron not found"
        return 1
    fi
    
    # Check system tools
    local tools=("sensors" "smartctl")
    for tool in "${tools[@]}"; do
        if command_exists "$tool"; then
            print_success "$tool available"
        else
            print_warning "$tool not found (optional)"
        fi
    done
}

# Function to create desktop entry
create_desktop_entry() {
    print_status "Creating desktop entry..."
    
    local desktop_file="$HOME/.local/share/applications/linux-system-monitor.desktop"
    local app_dir="$(pwd)"
    
    cat > "$desktop_file" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Linux System Monitor
Comment=Comprehensive system resource monitoring application
Exec=$app_dir/run.sh
Icon=$app_dir/icon.png
Terminal=false
Categories=System;Monitor;
StartupNotify=true
EOF
    
    if [ -f "$desktop_file" ]; then
        print_success "Desktop entry created: $desktop_file"
        print_status "You can now find 'Linux System Monitor' in your applications menu"
    else
        print_warning "Failed to create desktop entry"
    fi
}

# Main setup function
main() {
    echo "=========================================="
    echo "  Linux System Monitor Setup Script"
    echo "=========================================="
    echo
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_error "Please do not run this script as root"
        exit 1
    fi
    
    # Detect distribution
    distro=$(detect_distro)
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        actual_distro="$PRETTY_NAME"
    else
        actual_distro="$distro"
    fi
    print_status "Detected distribution: $actual_distro (using $distro package manager)"
    
    # Install system dependencies
    install_system_deps "$distro"
    
    # Install Node.js
    install_nodejs "$distro"
    
    # Configure sensors
    configure_sensors
    
    # Check GPU drivers
    check_gpu_drivers
    
    # Install npm dependencies
    install_npm_deps
    
    # Verify installation
    if verify_installation; then
        print_success "Installation completed successfully!"
    else
        print_error "Installation verification failed"
        exit 1
    fi
    
    # Create desktop entry
    create_desktop_entry
    
    echo
    echo "=========================================="
    echo "  Setup Complete!"
    echo "=========================================="
    echo
    print_success "You can now run the application using:"
    echo "  ./run.sh"
    echo
    print_success "Or use npm:"
    echo "  npm start"
    echo
    print_status "For development mode with DevTools:"
    echo "  npm run dev"
    echo
    print_warning "Note: Some features may require additional kernel modules or drivers."
    print_warning "Check the README.md for troubleshooting information."
}

# Run main function
main "$@"
