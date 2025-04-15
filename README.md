# Shelly Heating Control System

A smart heating control system that manages Shelly-powered radiators using schedules and temperature sensors.

## Overview

This project provides a complete solution for controlling radiators powered by Shelly smart relays. It consists of:

1. **Backend Service** (`shelly-local-backend`) - Express.js server that communicates with Shelly devices and implements heating control logic
2. **Web Interface** (`shelly-heating-ui`) - React-based UI for managing rooms, devices, schedules, and controlling heating

![Shelly Device Connected to Radiator](./images//physical-installation%20(1).jpg.jpg)
![Shelly Device Connected to Radiator](./images//physical-installation%20(2).jpg.jpg)

## Features

- **Multiple Control Modes**:
  - **Schedule Mode**: Control radiators based on time-of-day schedules
  - **Thermostat Mode**: Control radiators based on temperature from BT sensors
  
- **Room Management**:
  - Create rooms with multiple radiators
  - Set schedules for each day of the week
  - Configure temperature targets for thermostat mode
  
- **Device Control**:
  - Support for Shelly 1/1PM/Plus devices with relays
  - Support for Shelly BT temperature sensors
  - Direct control to boost heating when needed
  
- **Boost Mode**: Temporarily override schedules to provide immediate heating

## Screenshots

### Home Screen
![Home Screen - Room Overview](./images/homepage.png)

### Schedule Editor
![Schedule Editor Screen](./images/schedule-manager.png)

### Settings Panel
![Settings Screen - Device Configuration](./images/settings-page.png)

## Installation

### Backend

1. Navigate to the backend directory:
   ```
   cd shelly-local-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   node server.js
   ```

### Frontend

1. Navigate to the frontend directory:
   ```
   cd shelly-heating-ui
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. For development:
   ```
   npm run dev
   ```

4. For production build:
   ```
   npm run build
   ```

## Configuration

### Backend Configuration

The backend server uses two primary JSON files to store configuration:

- `devices.json` - Stores information about all your Shelly devices
- `rooms.json` - Stores room configurations, schedules, and control settings

You can edit these files directly, or use the web interface to manage settings.

### Network Configuration

Ensure all Shelly devices are on the same network as the backend server. Edit the `HOST` and `PORT` variables in `server.js` to match your network setup.

### Frontend Configuration

The React frontend communicates with the backend API. Update the `API_BASE_URL` in `src/services/api.js` to match your backend server's address.

## Usage

### Home Page

The home page shows all rooms with their current status. From here you can:
- View room temperature and target temperature
- Toggle boost mode for immediate heating
- View which radiators are currently active

![Room Card with Boost Mode](./images/boost-mode.png)

### Schedule Page

The schedule page allows you to:
- Select a room to edit its schedule
- Define heating periods for each day of the week
- Set target temperatures for each time slot (in thermostat mode)
- Select which radiators should be active during each period
- Copy schedules between days for quick setup

![Schedule Copy Feature](./images/copy-schedule.png)

### Settings Page

The settings page provides configuration for:
- Adding, editing, and removing Shelly devices
- Creating and configuring rooms
- Setting control modes and parameters

![Adding a New Device](./images/add-device.png)

## API Endpoints

The backend provides REST API endpoints for:

- Device management: `/devices/...`
- Room management: `/rooms/...`
- Boost control: `/rooms/:roomId/boost`
- Temperature control: `/rooms/:roomId/target`
- Schedule control: `/rooms/:roomId/schedule`

## Control Modes

### Schedule Mode

Schedule mode activates radiators based on time schedules. Each day can have multiple time slots, and each slot can activate different radiators.

![Schedule Mode Example](./images/schedule-manager.png)

### Thermostat Mode

Thermostat mode uses temperature sensors to maintain a target temperature. The system will:
1. Read the current temperature from a Shelly BT Home sensor
2. Compare it with the target temperature (with hysteresis)
3. Activate radiators when heating is needed
4. Turn off radiators when the target temperature is reached

Thermostatic control can be combined with schedules for different target temperatures throughout the day.

## License

This project is intended for personal use.
