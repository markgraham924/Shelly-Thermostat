const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const DEVICES_DATA_FILE = path.join(__dirname, "devices.json");
const ROOMS_DATA_FILE = path.join(__dirname, "rooms.json"); // New data file
const HOST = "192.168.0.18";

const CONTROL_LOOP_INTERVAL_MS = 10 * 1000; // Check every 60 seconds

// --- Middleware ---
// Enable CORS for requests from your frontend origin
app.use(cors({
    origin: 'http://192.168.0.18:5173' // <--- Allow your React app's origin
    // You might also need to specify allowed methods and headers if needed,
    // but this is often sufficient for development.
    // methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // allowedHeaders: ['Content-Type', 'Authorization'],
  }));

app.use(express.json());

// --- Data Storage Helpers (Devices) ---
const readDevices = async () => {
    try {
        const data = await fs.readFile(DEVICES_DATA_FILE, "utf8");
        const parsedData = JSON.parse(data);
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        if (error.code === "ENOENT") {
            await writeDevices([]);
            return [];
        }
        console.error("Error reading devices file:", error);
        return [];
    }
};
const writeDevices = async (devices) => {
    try {
        await fs.writeFile(DEVICES_DATA_FILE, JSON.stringify(devices, null, 2), "utf8");
    } catch (error) {
        console.error("Error writing devices file:", error);
    }
};

// --- Data Storage Helpers (Rooms) ---
const readRooms = async () => {
    try {
        const data = await fs.readFile(ROOMS_DATA_FILE, "utf8");
        const parsedData = JSON.parse(data);
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        if (error.code === "ENOENT") {
            await writeRooms([]); // Create file if it doesn't exist
            return [];
        }
        console.error("Error reading rooms file:", error);
        return [];
    }
};
const writeRooms = async (rooms) => {
    try {
        await fs.writeFile(ROOMS_DATA_FILE, JSON.stringify(rooms, null, 2), "utf8");
    } catch (error) {
        console.error("Error writing rooms file:", error);
    }
};

// --- Shelly API Helpers (Keep existing ones) ---
const getSwitchStatusUrl = (ip, relayIndex) => `http://${ip}/rpc/Switch.GetStatus?id=${relayIndex}`;
const getSwitchSetUrl = (ip, relayIndex, state) => `http://${ip}/rpc/Switch.Set?id=${relayIndex}&on=${state}`;
const getSwitchToggleUrl = (ip, relayIndex) => `http://${ip}/rpc/Switch.Toggle?id=${relayIndex}`;
const getBTHomeSensorStatusUrl = (ip, sensorId) => `http://${ip}/rpc/BTHomeSensor.GetStatus?id=${sensorId}`;

// --- Helper to get device details by ID ---
const findDeviceById = (devices, deviceId) => devices.find((d) => d.id === deviceId);

// --- API Routes for Devices (Keep existing ones, maybe add PUT/DELETE later) ---
// GET /devices
app.get("/devices", async (req, res) => {
    const devices = await readDevices();
    res.json(devices);
});
// GET /devices/:id - Get a single device's details
app.get("/devices/:id", async (req, res) => {
    const deviceId = req.params.id;
    const devices = await readDevices();
    const device = findDeviceById(devices, deviceId); // Use existing helper

    if (!device) {
        return res.status(404).json({ message: "Device not found" });
    }
    res.json(device);
});
// PUT /devices/:id - Update an existing device
app.put("/devices/:id", async (req, res) => {
    const deviceId = req.params.id;
    const { name, ip, relayIndex, btSensorId } = req.body; // Allow updating these fields

    // Basic validation (similar to POST, but fields are optional for update)
    if (relayIndex !== undefined && (typeof relayIndex !== 'number' || relayIndex < 0)) {
        return res.status(400).json({ message: "Invalid relayIndex." });
    }
    if (btSensorId !== undefined && typeof btSensorId !== 'number' && btSensorId !== null) {
         // Allow setting btSensorId to null to remove it
        return res.status(400).json({ message: "Invalid btSensorId. Must be a number or null." });
    }

    const devices = await readDevices();
    const deviceIndex = devices.findIndex(d => d.id === deviceId);

    if (deviceIndex === -1) {
        return res.status(404).json({ message: "Device not found" });
    }

    // Update fields if they are provided in the request body
    const updatedDevice = { ...devices[deviceIndex] }; // Copy existing device
    if (name !== undefined) updatedDevice.name = name;
    if (ip !== undefined) updatedDevice.ip = ip;
    if (relayIndex !== undefined) updatedDevice.relayIndex = Number(relayIndex);

    // Handle btSensorId update (allow adding, changing, or removing)
    if (btSensorId !== undefined) {
        updatedDevice.btSensorId = btSensorId === null ? undefined : Number(btSensorId);
         // Store as undefined if null is passed, otherwise store as number
         if (updatedDevice.btSensorId === undefined) {
            delete updatedDevice.btSensorId; // Cleanly remove the key
         }
    }


    devices[deviceIndex] = updatedDevice; // Replace in the array
    await writeDevices(devices);

    console.log(`Updated device: ${updatedDevice.name} (ID: ${deviceId})`);
    res.json(updatedDevice);
});

// DELETE /devices/:id - Delete a device
app.delete("/devices/:id", async (req, res) => {
    const deviceId = req.params.id;
    const devices = await readDevices();
    const initialLength = devices.length;
    const updatedDevices = devices.filter(d => d.id !== deviceId);

    if (updatedDevices.length === initialLength) {
        return res.status(404).json({ message: "Device not found" });
    }

    // **Important Consideration:** Deleting a device referenced by a room
    // will cause errors in the control loop or room display later.
    // A more robust solution would check room references before deleting
    // or automatically remove the device ID from rooms.
    // For now, we proceed with simple deletion.
    console.warn(`Deleting device ${deviceId}. Check rooms that might reference it.`);

    await writeDevices(updatedDevices);
    console.log(`Deleted device: ${deviceId}`);
    res.status(204).send(); // No content
});
// POST /devices
app.post("/devices", async (req, res) => {
    const { id, name, ip, relayIndex, btSensorId } = req.body;
    if (id === undefined || name === undefined || ip === undefined || relayIndex === undefined) {
        return res.status(400).json({ message: "Missing required fields: id, name, ip, relayIndex" });
    }
    if (typeof relayIndex !== "number" || relayIndex < 0) {
        return res.status(400).json({ message: "Invalid relayIndex." });
    }
    if (btSensorId !== undefined && typeof btSensorId !== "number") {
        return res.status(400).json({ message: "Invalid btSensorId." });
    }

    const devices = await readDevices();
    if (devices.some((device) => device.id === id)) {
        return res.status(409).json({ message: `Device with id '${id}' already exists` });
    }

    const newDevice = { id, name, ip, relayIndex: Number(relayIndex) };
    if (btSensorId !== undefined) newDevice.btSensorId = Number(btSensorId);

    devices.push(newDevice);
    await writeDevices(devices);
    console.log(`Added device: ${name} (ID: ${id})`);
    res.status(201).json(newDevice);
});
// GET /devices/:id/status - Get the status of a specific Shelly device relay
app.get("/devices/:id/status", async (req, res) => {
    const deviceId = req.params.id;
    const devices = await readDevices();
    const device = devices.find((d) => d.id === deviceId);

    if (!device) {
        return res.status(404).json({ message: "Device not found" });
    }

    const shellyStatusUrl = getSwitchStatusUrl(device.ip, device.relayIndex);

    try {
        console.log(
            `Fetching status for ${device.name} (ID: ${deviceId}) from ${shellyStatusUrl}`
        );
        const response = await axios.get(shellyStatusUrl, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        console.error(
            `Error fetching status for ${device.name} (${device.ip}, Relay ${device.relayIndex}):`,
            error.message
        );
        res.status(500).json({
            message: `Failed to fetch status from Shelly device relay ${device.name}`,
            error: error.message,
        });
    }
});

// GET /devices/:id/power - Get just the current power consumption
app.get("/devices/:id/power", async (req, res) => {
    const deviceId = req.params.id;
    const devices = await readDevices();
    const device = devices.find((d) => d.id === deviceId);

    if (!device) {
        return res.status(404).json({ message: "Device not found" });
    }

    const shellyStatusUrl = getSwitchStatusUrl(device.ip, device.relayIndex);

    try {
        console.log(
            `Fetching power for ${device.name} (ID: ${deviceId}) from ${shellyStatusUrl}`
        );
        const response = await axios.get(shellyStatusUrl, { timeout: 5000 });
        const power = response.data?.apower ?? 0;
        res.json({ id: deviceId, name: device.name, apower: power });
    } catch (error) {
        console.error(
            `Error fetching power for ${device.name} (${device.ip}, Relay ${device.relayIndex}):`,
            error.message
        );
        res.status(500).json({
            message: `Failed to fetch power from Shelly device relay ${device.name}`,
            error: error.message,
        });
    }
});

// NEW: GET /devices/:id/sensor - Get the status of the associated BT sensor
app.get("/devices/:id/sensor", async (req, res) => {
    const deviceId = req.params.id;
    const devices = await readDevices();
    const device = devices.find((d) => d.id === deviceId);

    if (!device) {
        return res.status(404).json({ message: "Device not found" });
    }

    // Check if this device has a BT sensor ID defined
    if (device.btSensorId === undefined) {
        return res
            .status(404)
            .json({ message: "No BT Sensor ID defined for this device" });
    }

    const sensorStatusUrl = getBTHomeSensorStatusUrl(device.ip, device.btSensorId);

    try {
        console.log(
            `Fetching BT sensor status for ${device.name} (ID: ${deviceId}, Sensor: ${device.btSensorId}) from ${sensorStatusUrl}`
        );
        const response = await axios.get(sensorStatusUrl, { timeout: 5000 });
        // The response contains { id, value, last_updated_ts } 
        res.json(response.data);
    } catch (error) {
        // Handle cases where the sensor might not be reachable or doesn't exist on the Shelly
        if (error.response && error.response.status === 400) {
            console.warn(`BT Sensor ${device.btSensorId} not found or invalid on ${device.name} (${device.ip})`);
            return res.status(404).json({ message: `BT Sensor with ID ${device.btSensorId} not found on device ${device.name}` });
        }
        console.error(
            `Error fetching BT sensor status for ${device.name} (${device.ip}, Sensor ${device.btSensorId}):`,
            error.message
        );
        res.status(500).json({
            message: `Failed to fetch BT sensor status from Shelly device ${device.name}`,
            error: error.message,
        });
    }
});

// POST /devices/:id/control - Control a specific Shelly device relay (on/off)
app.post("/devices/:id/control", async (req, res) => {
    const deviceId = req.params.id;
    const { state } = req.body; // Expecting { "state": "on" } or { "state": "off" }

    if (state !== "on" && state !== "off") {
        return res
            .status(400)
            .json({ message: "Invalid 'state' value. Use 'on' or 'off'." });
    }

    const devices = await readDevices();
    const device = devices.find((d) => d.id === deviceId);

    if (!device) {
        return res.status(404).json({ message: "Device not found" });
    }

    const turnOn = state === "on"; // Convert "on"/"off" to boolean true/false
    const shellyControlUrl = getSwitchSetUrl(device.ip, device.relayIndex, turnOn);

    try {
        console.log(
            `Sending command to ${device.name} (ID: ${deviceId}): ${shellyControlUrl}`
        );
        await axios.get(shellyControlUrl, { timeout: 5000 });

        // Fetch the new status to return it
        const statusUrl = getSwitchStatusUrl(device.ip, device.relayIndex);
        const statusResponse = await axios.get(statusUrl, { timeout: 5000 });
        res.json(statusResponse.data);
    } catch (error) {
        console.error(
            `Error controlling relay for ${device.name} (${device.ip}, Relay ${device.relayIndex}):`,
            error.message
        );
        res.status(500).json({
            message: `Failed to control relay on Shelly device ${device.name}`,
            error: error.message,
        });
    }
});

// POST /devices/:id/toggle - Toggle a specific Shelly device relay
app.post("/devices/:id/toggle", async (req, res) => {
    const deviceId = req.params.id;
    const devices = await readDevices();
    const device = devices.find((d) => d.id === deviceId);

    if (!device) {
        return res.status(404).json({ message: "Device not found" });
    }

    const shellyToggleUrl = getSwitchToggleUrl(device.ip, device.relayIndex);

    try {
        console.log(
            `Sending toggle command to ${device.name} (ID: ${deviceId}): ${shellyToggleUrl}`
        );
        await axios.get(shellyToggleUrl, { timeout: 5000 });

        // Fetch the full new status to return it
        const statusUrl = getSwitchStatusUrl(device.ip, device.relayIndex);
        const statusResponse = await axios.get(statusUrl, { timeout: 5000 });
        res.json(statusResponse.data);
    } catch (error) {
        console.error(
            `Error toggling relay for ${device.name} (${device.ip}, Relay ${device.relayIndex}):`,
            error.message
        );
        res.status(500).json({
            message: `Failed to toggle relay on Shelly device ${device.name}`,
            error: error.message,
        });
    }
});

// --- Data Structure for Boost Mode ---
const activeBoosts = {}; // Format: { roomId: { until: timestamp, radiatorIds: [...] } }

// --- API Routes for Boost Mode ---
// POST /rooms/:roomId/boost - Enable boost mode for a room
app.post("/rooms/:roomId/boost", async (req, res) => {
    const roomId = req.params.roomId;
    const { durationMinutes, radiatorIds } = req.body;
    
    // Validate input
    if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({ message: "Valid durationMinutes is required" });
    }
    
    const rooms = await readRooms();
    const room = rooms.find(r => r.roomId === roomId);
    
    if (!room) {
        return res.status(404).json({ message: "Room not found" });
    }
    
    // Determine which radiators to boost
    let boostedRadiators;
    if (Array.isArray(radiatorIds) && radiatorIds.length > 0) {
        // Validate that all specified radiators belong to this room
        boostedRadiators = radiatorIds.filter(id => room.radiatorDeviceIds.includes(id));
        if (boostedRadiators.length === 0) {
            return res.status(400).json({ message: "None of the specified radiators belong to this room" });
        }
    } else {
        // If no radiator IDs provided, boost all radiators in the room
        boostedRadiators = [...room.radiatorDeviceIds];
    }
    
    // Calculate boost end time
    const boostUntil = new Date(Date.now() + (durationMinutes * 60 * 1000));
    
    // Store the boost information
    activeBoosts[roomId] = {
        until: boostUntil,
        radiatorIds: boostedRadiators
    };
    
    console.log(`Boost activated for room ${room.name} (ID: ${roomId}) until ${boostUntil.toLocaleString()}`);
    res.json({ 
        roomId,
        boostedRadiators,
        boostUntil,
        remainingMinutes: durationMinutes
    });
});

// POST /rooms/:roomId/cancel-boost - Cancel boost mode for a room
app.post("/rooms/:roomId/cancel-boost", async (req, res) => {
    const roomId = req.params.roomId;
    
    if (!activeBoosts[roomId]) {
        return res.status(404).json({ message: "No active boost found for this room" });
    }
    
    // Remove the boost
    delete activeBoosts[roomId];
    console.log(`Boost cancelled for room ${roomId}`);
    res.json({ message: "Boost cancelled successfully" });
});

// GET /rooms/:roomId/boost-status - Check if a room is in boost mode
app.get("/rooms/:roomId/boost-status", async (req, res) => {
    const roomId = req.params.roomId;
    
    if (!activeBoosts[roomId]) {
        return res.json({ boosted: false });
    }
    
    // Calculate remaining time
    const remainingMs = activeBoosts[roomId].until - Date.now();
    
    // If boost has expired, clean it up
    if (remainingMs <= 0) {
        delete activeBoosts[roomId];
        return res.json({ boosted: false });
    }
    
    // Return boost status
    return res.json({
        boosted: true,
        until: activeBoosts[roomId].until,
        radiatorIds: activeBoosts[roomId].radiatorIds,
        remainingMinutes: Math.ceil(remainingMs / (60 * 1000))
    });
});

// GET /rooms/boosted - Get all currently boosted rooms
app.get("/rooms/boosted", async (req, res) => {
    const now = Date.now();
    const boostedRooms = {};
    
    // Clean up expired boosts and collect active ones
    Object.keys(activeBoosts).forEach(roomId => {
        if (activeBoosts[roomId].until > now) {
            boostedRooms[roomId] = {
                until: activeBoosts[roomId].until,
                radiatorIds: activeBoosts[roomId].radiatorIds,
                remainingMinutes: Math.ceil((activeBoosts[roomId].until - now) / (60 * 1000))
            };
        } else {
            delete activeBoosts[roomId];
        }
    });
    
    res.json(boostedRooms);
});

// --- API Routes for Rooms ---

// GET /rooms - List all rooms
app.get("/rooms", async (req, res) => {
    const rooms = await readRooms();
    res.json(rooms);
});

// POST /rooms - Create a new room
app.post("/rooms", async (req, res) => {
    const {
        roomId,
        name,
        radiatorDeviceIds,
        controlMode,
        sensorDeviceId, // Optional, required for thermostat mode
        targetTempC,   // Optional, required for thermostat mode
        hysteresisC,   // Optional, defaults if thermostat mode
        schedule,      // Optional, required for schedule mode
    } = req.body;

    // Basic Validation
    if (!roomId || !name || !radiatorDeviceIds || !controlMode) {
        return res.status(400).json({ message: "Missing required fields: roomId, name, radiatorDeviceIds, controlMode" });
    }
    if (!Array.isArray(radiatorDeviceIds)) {
        return res.status(400).json({ message: "radiatorDeviceIds must be an array" });
    }
    if (controlMode !== "thermostat" && controlMode !== "schedule") {
        return res.status(400).json({ message: "controlMode must be 'thermostat' or 'schedule'" });
    }

    const rooms = await readRooms();
    const devices = await readDevices(); // Need devices for validation

    // Check if room ID exists
    if (rooms.some(room => room.roomId === roomId)) {
        return res.status(409).json({ message: `Room with roomId '${roomId}' already exists` });
    }

    // Validate radiator device IDs exist
    for (const devId of radiatorDeviceIds) {
        if (!findDeviceById(devices, devId)) {
            return res.status(400).json({ message: `Radiator device with id '${devId}' not found` });
        }
    }

    const newRoom = {
        roomId,
        name,
        radiatorDeviceIds,
        controlMode,
        sensorDeviceId: null,
        targetTempC: null,
        hysteresisC: null,
        schedule: null,
    };

    // Thermostat Mode Validation & Setup
    if (controlMode === "thermostat") {
        if (!sensorDeviceId || targetTempC === undefined || targetTempC === null) {
            return res.status(400).json({ message: "Thermostat mode requires sensorDeviceId and targetTempC" });
        }
        const sensorDevice = findDeviceById(devices, sensorDeviceId);
        if (!sensorDevice) {
            return res.status(400).json({ message: `Sensor device with id '${sensorDeviceId}' not found` });
        }
        if (sensorDevice.btSensorId === undefined) {
            return res.status(400).json({ message: `Sensor device '${sensorDeviceId}' does not have a btSensorId defined` });
        }
        newRoom.sensorDeviceId = sensorDeviceId;
        newRoom.targetTempC = Number(targetTempC);
        newRoom.hysteresisC = hysteresisC !== undefined ? Number(hysteresisC) : 1.0; // Default hysteresis
    }

    // Schedule Mode Validation & Setup
    if (controlMode === "schedule") {
        // Basic schedule structure validation (can be more robust)
        if (!schedule || typeof schedule !== 'object') {
            return res.status(400).json({ message: "Schedule mode requires a valid schedule object" });
        }
        // Add more validation for days/time slots if needed
        newRoom.schedule = schedule;
    }

    rooms.push(newRoom);
    await writeRooms(rooms);
    console.log(`Created room: ${name} (ID: ${roomId})`);
    res.status(201).json(newRoom);
});

// GET /rooms/:roomId - Get details of a specific room
app.get("/rooms/:roomId", async (req, res) => {
    const roomId = req.params.roomId;
    const rooms = await readRooms();
    const room = rooms.find(r => r.roomId === roomId);
    if (!room) {
        return res.status(404).json({ message: "Room not found" });
    }
    res.json(room);
});

// PUT /rooms/:roomId - Update a room (can be complex, maybe separate endpoints are better)
// Example: Update target temp for a thermostat room
app.put("/rooms/:roomId/target", async (req, res) => {
    const roomId = req.params.roomId;
    const { targetTempC } = req.body;

    if (targetTempC === undefined || targetTempC === null) {
        return res.status(400).json({ message: "Missing targetTempC" });
    }

    const rooms = await readRooms();
    const roomIndex = rooms.findIndex(r => r.roomId === roomId);

    if (roomIndex === -1) {
        return res.status(404).json({ message: "Room not found" });
    }

    if (rooms[roomIndex].controlMode !== 'thermostat') {
        return res.status(400).json({ message: "Can only set target temperature for rooms in thermostat mode" });
    }

    rooms[roomIndex].targetTempC = Number(targetTempC);
    await writeRooms(rooms);
    console.log(`Updated target temperature for room ${roomId} to ${targetTempC}°C`);
    res.json(rooms[roomIndex]);
});

// Example: Update schedule for a schedule room
app.put("/rooms/:roomId/schedule", async (req, res) => {
    const roomId = req.params.roomId;
    const { schedule } = req.body; // Expect the full schedule object

    if (!schedule || typeof schedule !== 'object') {
        return res.status(400).json({ message: "Invalid schedule provided" });
    }
    // Add more robust validation of schedule structure here

    const rooms = await readRooms();
    const roomIndex = rooms.findIndex(r => r.roomId === roomId);

    if (roomIndex === -1) {
        return res.status(404).json({ message: "Room not found" });
    }

    // REMOVE THIS CHECK to allow schedule updates for both thermostat and schedule modes
    /* 
    if (rooms[roomIndex].controlMode !== 'schedule') {
        return res.status(400).json({ message: "Can only set schedule for rooms in schedule mode" });
    }
    */

    rooms[roomIndex].schedule = schedule;
    await writeRooms(rooms);
    console.log(`Updated schedule for room ${roomId}`);
    res.json(rooms[roomIndex]);
});

// DELETE /rooms/:roomId - Delete a room
app.delete("/rooms/:roomId", async (req, res) => {
    const roomId = req.params.roomId;
    const rooms = await readRooms();
    const initialLength = rooms.length;
    const updatedRooms = rooms.filter(r => r.roomId !== roomId);

    if (updatedRooms.length === initialLength) {
        return res.status(404).json({ message: "Room not found" });
    }

    await writeRooms(updatedRooms);
    console.log(`Deleted room: ${roomId}`);
    res.status(204).send(); // No content on successful delete
});
// PUT /rooms/:roomId - Update an existing room (replace entire room config)
app.put("/rooms/:roomId", async (req, res) => {
    const roomId = req.params.roomId;
    // Expect the full room object in the body, similar to POST
    const {
        name, radiatorDeviceIds, controlMode, schedule,
        sensorDeviceId, targetTempC, hysteresisC
    } = req.body;

    // --- Perform validation similar to POST /rooms ---
    if (!name || !radiatorDeviceIds || !controlMode || !schedule) {
        return res.status(400).json({ message: "Missing required fields: name, radiatorDeviceIds, controlMode, schedule" });
    }
    // ... (add other validation checks from POST /rooms here: array check, mode check, schedule object check)

    const rooms = await readRooms();
    const devices = await readDevices(); // Needed for validation
    const roomIndex = rooms.findIndex(r => r.roomId === roomId);

    if (roomIndex === -1) {
        return res.status(404).json({ message: "Room not found" });
    }

    // Validate radiator device IDs exist
    for (const devId of radiatorDeviceIds) {
        if (!findDeviceById(devices, devId)) {
        return res.status(400).json({ message: `Radiator device with id '${devId}' not found` });
        }
    }

    const updatedRoom = {
        roomId, // Keep original ID
        name,
        radiatorDeviceIds,
        controlMode,
        schedule,
        sensorDeviceId: null,
        targetTempC: null,
        hysteresisC: null,
    };

    // Thermostat Mode Validation & Setup
    if (controlMode === "thermostat") {
        if (!sensorDeviceId || targetTempC === undefined || targetTempC === null) {
            return res.status(400).json({ message: "Thermostat mode requires sensorDeviceId and targetTempC" });
        }
        const sensorDevice = findDeviceById(devices, sensorDeviceId);
        if (!sensorDevice || sensorDevice.btSensorId === undefined) {
            return res.status(400).json({ message: `Invalid or non-sensor device specified: '${sensorDeviceId}'` });
        }
        updatedRoom.sensorDeviceId = sensorDeviceId;
        updatedRoom.targetTempC = Number(targetTempC);
        updatedRoom.hysteresisC = hysteresisC !== undefined ? Number(hysteresisC) : 1.0;
    }
    // --- End validation ---

    rooms[roomIndex] = updatedRoom; // Replace the room object
    await writeRooms(rooms);
    console.log(`Updated room: ${updatedRoom.name} (ID: ${roomId})`);
    res.json(updatedRoom);
});

// --- Heating Control Loop ---

let lastCommandedRadiatorState = {};

const heatingControlLoop = async () => {
  console.log("Running heating control loop...");
  const devices = await readDevices();
  const rooms = await readRooms();
  const commandsToSend = {};
  
  // Clean up expired boosts first
  const now = Date.now();
  Object.keys(activeBoosts).forEach(roomId => {
      if (activeBoosts[roomId].until <= now) {
          console.log(`Boost for room ${roomId} has expired`);
          delete activeBoosts[roomId];
      }
  });

  for (const room of rooms) {
    try {
      const now = new Date();
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todaysSchedule = room.schedule?.[dayOfWeek] || [];

      // Check for an active boost for this room
      const activeBoost = activeBoosts[room.roomId];

      let activeSlot = null;
      for (const slot of todaysSchedule) {
        if (currentTime >= slot.startTime && currentTime < slot.endTime) {
          activeSlot = slot;
          break;
        }
      }

      // Get the list of radiators enabled by the schedule for this specific time slot
      const enabledIdsInSlot = activeSlot?.enabledRadiatorIds || [];
      console.log(`Room ${room.roomId}: Active Slot Enabled Radiators: [${enabledIdsInSlot.join(', ')}]`);

      let heatingNeededByTemp = false;

      // --- Determine if heating is needed (Thermostat Mode ONLY) ---
      if (room.controlMode === "thermostat") {
        if (room.sensorDeviceId) {
          const sensorDevice = findDeviceById(devices, room.sensorDeviceId);
          if (sensorDevice?.btSensorId !== undefined) {
            const sensorUrl = getBTHomeSensorStatusUrl(sensorDevice.ip, sensorDevice.btSensorId);
            try {
              const sensorResponse = await axios.get(sensorUrl, { timeout: 5000 });
              const currentTemp = sensorResponse.data?.value;
              if (currentTemp !== undefined && currentTemp !== null) {
                // ENHANCEMENT: Get target temp from active slot if defined, otherwise use room's global target
                let targetTemp = room.targetTempC;
                let hysteresisC = room.hysteresisC;
                
                // If we have an active slot with a targetTempC defined, use that instead
                if (activeSlot && activeSlot.targetTempC !== undefined) {
                  console.log(`Room ${room.roomId}: Using schedule-defined target temperature of ${activeSlot.targetTempC}°C for current time slot`);
                  targetTemp = activeSlot.targetTempC;
                } else {
                  console.log(`Room ${room.roomId}: Using room's default target temperature of ${targetTemp}°C`);
                }
                
                const lowerBound = targetTemp - hysteresisC;
                const upperBound = targetTemp + hysteresisC;
                const lastAnyRadOn = room.radiatorDeviceIds.some(id => lastCommandedRadiatorState[id] === 'on');

                if (currentTemp < lowerBound) heatingNeededByTemp = true;
                else if (currentTemp > upperBound) heatingNeededByTemp = false;
                else heatingNeededByTemp = lastAnyRadOn; // Maintain state within band

                console.log(`Room ${room.roomId} (Thermo): Temp=${currentTemp}°C, Target=${targetTemp}°C => HeatingNeededByTemp=${heatingNeededByTemp}`);
              } else { console.warn(`Room ${room.roomId}: Could not read temp.`); }
            } catch (sensorError) { console.error(`Room ${room.roomId}: Error fetching sensor: ${sensorError.message}.`); }
          } else { console.warn(`Room ${room.roomId}: Invalid sensor device.`); }
        } else { console.warn(`Room ${room.roomId}: No sensor configured for thermostat mode.`); }
      }

      // --- Determine final state for EACH radiator in the room ---
      for (const radiatorId of room.radiatorDeviceIds) {
        let desiredRadiatorState = "off"; // Default off

        // Check if this radiator is being boosted
        const isRadiatorBoosted = activeBoost && activeBoost.radiatorIds.includes(radiatorId);
        
        if (isRadiatorBoosted) {
          // Boost mode overrides all other states
          desiredRadiatorState = "on";
          console.log(`Room ${room.roomId}: Radiator ${radiatorId} is in BOOST mode`);
        } else {
          // Regular schedule/thermostat logic if not boosted
          const isEnabledBySchedule = enabledIdsInSlot.includes(radiatorId);

          if (room.controlMode === "thermostat") {
            if (isEnabledBySchedule && heatingNeededByTemp) {
              desiredRadiatorState = "on";
            }
          } else if (room.controlMode === "schedule") {
            if (isEnabledBySchedule) {
              desiredRadiatorState = "on";
            }
          }
        }

        // Queue the command
        commandsToSend[radiatorId] = desiredRadiatorState;
      }

    } catch (roomError) {
      console.error(`Error processing room ${room.roomId}: ${roomError}`);
      for (const radiatorId of room.radiatorDeviceIds) { 
        commandsToSend[radiatorId] = "off"; 
      }
    }
  } // End of room loop

  // --- Apply all collected commands (No change needed here) ---
  console.log("Applying radiator commands:", commandsToSend);
  for (const deviceId in commandsToSend) {
    const desiredState = commandsToSend[deviceId];
    const device = findDeviceById(devices, deviceId);
    
    if (!device) {
      console.error(`Cannot apply command: Device ${deviceId} not found`);
      continue;
    }
    
    // Only send command if state has changed
    if (lastCommandedRadiatorState[deviceId] !== desiredState) {
      try {
        console.log(`Setting device ${deviceId} (${device.name}) to ${desiredState}`);
        const turnOn = desiredState === "on";
        const controlUrl = getSwitchSetUrl(device.ip, device.relayIndex, turnOn);
        await axios.get(controlUrl, { timeout: 5000 });
        lastCommandedRadiatorState[deviceId] = desiredState; // Update tracked state
      } catch (error) {
        console.error(`Failed to set ${device.name} to ${desiredState}: ${error.message}`);
      }
    }
  }
  console.log("Heating control loop finished.");
};


// --- Start the server and the control loop ---
app.listen(PORT, HOST, async () => {
    // Ensure data files exist on startup
    await readDevices();
    await readRooms();
    console.log(`Shelly local backend listening on http://localhost:${PORT}`);
    console.log(`Using devices file: ${DEVICES_DATA_FILE}`);
    console.log(`Using rooms file: ${ROOMS_DATA_FILE}`);

    // Run the loop once immediately, then set the interval
    console.log("Performing initial heating control check...");
    await heatingControlLoop();
    setInterval(heatingControlLoop, CONTROL_LOOP_INTERVAL_MS);
    console.log(`Heating control loop scheduled to run every ${CONTROL_LOOP_INTERVAL_MS / 1000} seconds.`);
});