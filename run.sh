#!/bin/bash

# Linux System Monitor Run Script
# This script launches the Linux System Monitor application with optimal settings

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project directory."
        exit 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_error "node_modules not found. Please run ./setup.sh first to install dependencies."
        exit 1
    fi
    
    # Check if Electron is installed
    if [ ! -f "node_modules/.bin/electron" ]; then
        print_error "Electron not found. Please run ./setup.sh first to install dependencies."
        exit 1
    fi
    
    # Check if native addon is built
    if [ -f "build/Release/system_monitor.node" ]; then
        print_success "Native addon found - performance optimizations available"
    else
        print_warning "Native addon not found - application will use JavaScript fallback"
        print_warning "Run ./setup.sh to build the native addon for better performance"
    fi
    
    print_success "Prerequisites check passed"
}

# Function to check system requirements
check_system_requirements() {
    print_status "Checking system requirements..."
    
    # Check if running on Linux
    if [ "$(uname)" != "Linux" ]; then
        print_warning "This application is designed for Linux. Some features may not work on other platforms."
    fi
    
    # Check for required system directories
    local required_dirs=("/sys/class/thermal" "/sys/class/hwmon" "/proc")
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_success "System directory accessible: $dir"
        else
            print_warning "System directory not accessible: $dir"
        fi
    done
    
    # Check for optional tools
    local optional_tools=("sensors" "smartctl" "nvidia-smi")
    for tool in "${optional_tools[@]}"; do
        if command_exists "$tool"; then
            print_success "Optional tool available: $tool"
        else
            print_warning "Optional tool not found: $tool (some features may be limited)"
        fi
    done
}

# Function to detect display server
detect_display_server() {
    # Check for Wayland
    if [ -n "$WAYLAND_DISPLAY" ] || [ "$XDG_SESSION_TYPE" = "wayland" ]; then
        echo "wayland"
    # Check for X11
    elif [ -n "$DISPLAY" ] || [ "$XDG_SESSION_TYPE" = "x11" ]; then
        echo "x11"
    # Fallback: try to detect from session
    elif command_exists loginctl; then
        local session_type=$(loginctl show-session $(loginctl | grep $(whoami) | awk '{print $1}') -p Type --value 2>/dev/null)
        if [ "$session_type" = "wayland" ]; then
            echo "wayland"
        else
            echo "x11"
        fi
    else
        # Default fallback
        echo "x11"
    fi
}

# Function to set optimal environment variables
set_environment() {
    print_status "Setting optimal environment variables..."
    
    # Disable GPU acceleration to prevent crashes
    export ELECTRON_DISABLE_GPU=1
    export ELECTRON_DISABLE_GPU_COMPOSITING=1
    export ELECTRON_DISABLE_GPU_SANDBOX=1
    
    # Set Node.js options for better performance
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    # Disable Chromium features that might cause issues
    export ELECTRON_DISABLE_SECURITY_WARNINGS=1
    
    print_success "Environment variables set"
}

# Function to check for running instances
check_running_instances() {
    print_status "Checking for running instances..."
    
    local pid_file="/tmp/linux-system-monitor.pid"
    
    if [ -f "$pid_file" ]; then
        local old_pid=$(cat "$pid_file")
        if kill -0 "$old_pid" 2>/dev/null; then
            print_warning "Another instance is already running (PID: $old_pid)"
            read -p "Do you want to terminate it and start a new instance? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_status "Terminating old instance..."
                kill "$old_pid" 2>/dev/null || true
                rm -f "$pid_file"
                sleep 2
            else
                print_status "Exiting..."
                exit 0
            fi
        else
            # Stale PID file
            rm -f "$pid_file"
        fi
    fi
}

# Function to create PID file
create_pid_file() {
    local pid_file="/tmp/linux-system-monitor.pid"
    echo $$ > "$pid_file"
}

# Function to cleanup on exit
cleanup() {
    local pid_file="/tmp/linux-system-monitor.pid"
    if [ -f "$pid_file" ]; then
        rm -f "$pid_file"
    fi
    print_status "Application closed"
}

# Function to run the application
run_application() {
    local mode=${1:-"production"}
    local use_sudo=${2:-false}
    
    print_status "Starting Linux System Monitor in $mode mode..."
    
    # Detect display server
    local display_server=$(detect_display_server)
    print_status "Detected display server: $display_server"
    
    # Create PID file
    create_pid_file
    
    # Set up cleanup trap
    trap cleanup EXIT INT TERM
    
    # Run the application
    if [ "$mode" = "dev" ]; then
        print_status "Starting in development mode with DevTools..."
        if [ "$use_sudo" = true ]; then
            # Preserve user environment for npm access and add flags for root
            sudo -E env "PATH=$PATH" npm run dev -- --no-sandbox --ozone-platform=$display_server
        else
            npm run dev
        fi
    else
        print_status "Starting in production mode..."
        if [ "$use_sudo" = true ]; then
            # Preserve user environment for npm access and add flags for root
            sudo -E env "PATH=$PATH" npm start -- --no-sandbox --ozone-platform=$display_server
        else
            npm start
        fi
    fi
}

# Function to show help
show_help() {
    echo "Linux System Monitor Run Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -d, --dev     Start in development mode with DevTools"
    echo "  -h, --help    Show this help message"
    echo "  -c, --check   Only check prerequisites and system requirements"
    echo "  -v, --verbose Enable verbose output"
    echo "  -s, --sudo    Run with elevated privileges (for Intel RAPL power monitoring)"
    echo
    echo "Performance:"
    echo "  The application includes a native C++ addon for improved performance."
    echo "  If the native addon is not found, the application will use JavaScript fallback."
    echo "  Run ./setup.sh to ensure the native addon is built."
    echo
    echo "Examples:"
    echo "  $0              # Start in production mode"
    echo "  $0 --dev        # Start in development mode"
    echo "  $0 --sudo       # Start with elevated privileges"
    echo "  $0 --check      # Check system requirements only"
}

# Function to perform system check only
system_check_only() {
    echo "=========================================="
    echo "  Linux System Monitor - System Check"
    echo "=========================================="
    echo
    
    check_prerequisites
    check_system_requirements
    
    echo
    echo "=========================================="
    echo "  System Check Complete"
    echo "=========================================="
    echo
    print_success "System is ready to run the Linux System Monitor"
    print_status "Run '$0' to start the application"
    print_status "Run '$0 --sudo' to start with elevated privileges (for Intel RAPL power monitoring)"
    print_status "Run './setup.sh' to build the native addon for optimal performance"
}

# Main function
main() {
    local mode="production"
    local check_only=false
    local verbose=false
    local use_sudo=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dev)
                mode="dev"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--check)
                check_only=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -s|--sudo)
                use_sudo=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Enable verbose output if requested
    if [ "$verbose" = true ]; then
        set -x
    fi
    
    # Show header
    if [ "$check_only" = false ]; then
        echo "=========================================="
        echo "  Linux System Monitor"
        echo "=========================================="
        echo
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Check system requirements
    check_system_requirements
    
    # If check-only mode, exit here
    if [ "$check_only" = true ]; then
        system_check_only
        exit 0
    fi
    
    # Set environment
    set_environment
    
    # Check for running instances
    check_running_instances
    
    # Run the application
    run_application "$mode" "$use_sudo"
}

# Run main function with all arguments
main "$@"
