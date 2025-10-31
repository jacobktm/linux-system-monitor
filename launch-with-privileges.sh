#!/bin/bash

# Linux System Monitor - Launch with Privileges
# This script launches the app with elevated privileges using a GUI prompt

set -e

# Check if we're running from an AppImage
if [ -n "$APPIMAGE" ]; then
    # Running from AppImage
    APP_DIR="$(dirname "$APPIMAGE")"
    APP_NAME="$(basename "$APPIMAGE")"
    EXECUTABLE="$APPIMAGE"
elif [ -f "$(dirname "$0")/linux-system-monitor" ]; then
    # Running from unpacked directory
    APP_DIR="$(dirname "$0")"
    EXECUTABLE="$APP_DIR/linux-system-monitor"
else
    # Fallback - assume we're in the project directory
    EXECUTABLE="$0"
fi

# Detect display server
detect_display() {
    if [ -n "$WAYLAND_DISPLAY" ] || [ "$XDG_SESSION_TYPE" = "wayland" ]; then
        echo "wayland"
    elif [ -n "$DISPLAY" ] || [ "$XDG_SESSION_TYPE" = "x11" ]; then
        echo "x11"
    else
        echo "x11"
    fi
}

# Function to check if we need elevated privileges
needs_privileges() {
    # Check if we can read RAPL power data (requires root on some systems)
    if [ ! -r "/sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj" ] 2>/dev/null; then
        return 0  # Needs privileges
    fi
    return 1  # Doesn't need privileges
}

# Function to launch with GUI privilege prompt
launch_with_pkexec() {
    local display=$(detect_display)
    
    # Use pkexec for GUI privilege elevation (works with both X11 and Wayland)
    if command -v pkexec >/dev/null 2>&1; then
        # Create a temporary script that pkexec can run
        local temp_script=$(mktemp)
        cat > "$temp_script" << 'EOF'
#!/bin/bash
# Preserve environment and run the app
export DISPLAY="$DISPLAY"
export WAYLAND_DISPLAY="$WAYLAND_DISPLAY"
export XDG_SESSION_TYPE="$XDG_SESSION_TYPE"
export HOME="$HOME"
export USER="$USER"
export XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR"
export XDG_CONFIG_HOME="$XDG_CONFIG_HOME"
export XDG_DATA_HOME="$XDG_DATA_HOME"

# Run the application with no-sandbox flag for root execution
"$@" --no-sandbox
EOF
        chmod +x "$temp_script"
        
        # Use pkexec with a descriptive message
        pkexec env DISPLAY="$DISPLAY" WAYLAND_DISPLAY="$WAYLAND_DISPLAY" \
              XDG_SESSION_TYPE="$XDG_SESSION_TYPE" \
              HOME="$HOME" USER="$USER" \
              XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
              "$temp_script" "$EXECUTABLE"
        
        local exit_code=$?
        rm -f "$temp_script"
        exit $exit_code
    else
        # Fallback to sudo with gksu/gksudo or zenity/kdialog GUI
        if command -v gksu >/dev/null 2>&1; then
            gksu "$EXECUTABLE --no-sandbox"
        elif command -v gksudo >/dev/null 2>&1; then
            gksudo "$EXECUTABLE --no-sandbox"
        elif command -v zenity >/dev/null 2>&1; then
            # Use zenity to prompt for password, then sudo
            zenity --password --title="Linux System Monitor - Privileges Required" | \
                sudo -S "$EXECUTABLE --no-sandbox"
        elif command -v kdialog >/dev/null 2>&1; then
            # Use kdialog to prompt for password, then sudo
            kdialog --password "Enter your password to run Linux System Monitor with elevated privileges:" | \
                sudo -S "$EXECUTABLE --no-sandbox"
        else
            # Last resort: prompt user
            echo "Graphical privilege elevation not available."
            echo "Please run with sudo manually:"
            echo "  sudo $EXECUTABLE --no-sandbox"
            exit 1
        fi
    fi
}

# Main execution
if needs_privileges; then
    # We need elevated privileges - prompt graphically
    launch_with_pkexec
else
    # No privileges needed - run normally
    exec "$EXECUTABLE" "$@"
fi

