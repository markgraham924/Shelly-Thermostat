// src/components/RoomForm.js (Rename from AddRoomForm.js)
import React, { useState, useEffect } from "react";
import {
  Box, TextField, Button, CircularProgress, Alert, Select, MenuItem,
  InputLabel, FormControl, OutlinedInput, Chip, Checkbox, ListItemText,
  Typography, Divider, IconButton, Grid, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { getDevices, addRoom, updateRoom } from "../services/api"; // Import updateRoom

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

// Default empty schedule structure
const defaultSchedule = () => ({
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
});

// Helper to deep copy schedule
const deepCopySchedule = (schedule) => {
    // Handle cases where schedule might be null or undefined initially
    if (!schedule) return defaultSchedule();
    try {
        return JSON.parse(JSON.stringify(schedule));
    } catch (e) {
        console.error("Error deep copying schedule:", e);
        return defaultSchedule(); // Return default on error
    }
};

// Accept props: isEditMode, initialData, onSubmitSuccess, onCancel
const RoomForm = ({ isEditMode = false, initialData = null, onSubmitSuccess, onCancel }) => {
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [formData, setFormData] = useState({
    roomId: "", name: "", radiatorDeviceIds: [], controlMode: "schedule",
    sensorDeviceId: "", targetTempC: "", hysteresisC: "1.0", schedule: defaultSchedule(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Success message handled by parent Snackbar

  // Fetch devices for dropdowns
  useEffect(() => {
    const fetchDevices = async () => {
      setLoadingDevices(true);
      setError(null); // Clear previous errors
      try {
        const response = await getDevices();
        setDevices(response.data || []);
      } catch (err) {
        console.error("Failed to fetch devices for form:", err);
        setError("Could not load devices list.");
      } finally {
        setLoadingDevices(false);
      }
    };
    fetchDevices();
  }, []); // Run only once on mount

  // Pre-fill form if editing
  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        roomId: initialData.roomId || "",
        name: initialData.name || "",
        radiatorDeviceIds: initialData.radiatorDeviceIds || [],
        controlMode: initialData.controlMode || "schedule",
        sensorDeviceId: initialData.sensorDeviceId || "",
        targetTempC: initialData.targetTempC?.toString() || "",
        hysteresisC: initialData.hysteresisC?.toString() || "1.0",
        schedule: deepCopySchedule(initialData.schedule), // Use deep copy
      });
    } else {
      // Reset for Add mode
      setFormData({
        roomId: "", name: "", radiatorDeviceIds: [], controlMode: "schedule",
        sensorDeviceId: "", targetTempC: "", hysteresisC: "1.0", schedule: defaultSchedule()
      });
    }
  }, [isEditMode, initialData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'controlMode' && value !== 'thermostat') {
        setFormData((prev) => ({
            ...prev, sensorDeviceId: '', targetTempC: '', hysteresisC: '1.0'
        }));
    }
  };

  const handleMultiSelectChange = (event) => {
    const { target: { value } } = event;
    setFormData((prev) => ({
      ...prev,
      radiatorDeviceIds: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  // --- Schedule Management ---
   const handleAddScheduleSlot = (day) => {
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                [day]: [...(prev.schedule[day] || []), { 
                    startTime: '09:00', 
                    endTime: '17:00', 
                    enabledRadiatorIds: [], 
                    targetTempC: prev.controlMode === 'thermostat' ? 20 : undefined  // Add default target temp for thermostat rooms
                }]
            }
        }));
   };

   // Add handler for target temperature changes in schedule slots
   const handleScheduleTempChange = (day, index, value) => {
        setFormData(prev => {
            const updatedDaySchedule = [...prev.schedule[day]];
            updatedDaySchedule[index] = { 
                ...updatedDaySchedule[index], 
                targetTempC: value !== "" ? parseFloat(value) : undefined
            };
            return {
                ...prev,
                schedule: { ...prev.schedule, [day]: updatedDaySchedule }
            };
        });
   };

   const handleRemoveScheduleSlot = (day, index) => {
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                [day]: prev.schedule[day].filter((_, i) => i !== index)
            }
        }));
   };
   const handleScheduleChange = (day, index, field, value) => {
        setFormData(prev => {
            const updatedDaySchedule = [...prev.schedule[day]];
            updatedDaySchedule[index] = { ...updatedDaySchedule[index], [field]: value };
            return {
                ...prev,
                schedule: { ...prev.schedule, [day]: updatedDaySchedule }
            };
        });
   };
   // --- End Schedule Management ---

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Construct payload, ensuring numbers are numbers and schedule is properly initialized
    const roomPayload = {
      // roomId is NOT included in PUT body, only for POST
      name: formData.name,
      radiatorDeviceIds: formData.radiatorDeviceIds,
      controlMode: formData.controlMode,
      // Always ensure schedule is initialized for thermostat rooms
      schedule: formData.controlMode === 'thermostat' ? 
        (formData.schedule || defaultSchedule()) : formData.schedule,
      targetTempC: formData.controlMode === 'thermostat' && formData.targetTempC !== '' ? parseFloat(formData.targetTempC) : null,
      hysteresisC: formData.controlMode === 'thermostat' && formData.hysteresisC !== '' ? parseFloat(formData.hysteresisC) : null,
      sensorDeviceId: formData.controlMode === 'thermostat' ? formData.sensorDeviceId : null,
    };
    // Add roomId only if creating
    if (!isEditMode) {
        roomPayload.roomId = formData.roomId;
    }


    // --- Validation (similar to AddRoomForm) ---
    if ((!isEditMode && !roomPayload.roomId) || !roomPayload.name || roomPayload.radiatorDeviceIds.length === 0) {
        setError("Room ID, Name, and at least one Radiator are required."); setLoading(false); return;
    }
    if (roomPayload.controlMode === 'thermostat' && (!roomPayload.sensorDeviceId || roomPayload.targetTempC === null || isNaN(roomPayload.targetTempC))) {
         setError("Thermostat mode requires a Sensor Device and a valid Target Temperature."); setLoading(false); return;
    }
    if (roomPayload.controlMode === 'thermostat' && (roomPayload.hysteresisC === null || isNaN(roomPayload.hysteresisC) || roomPayload.hysteresisC <= 0)) {
         setError("Thermostat mode requires a valid positive Hysteresis value."); setLoading(false); return;
    }
    // Ensure thermostat rooms have a properly initialized schedule
    if (roomPayload.controlMode === 'thermostat' && (!roomPayload.schedule || typeof roomPayload.schedule !== 'object')) {
         setError("Thermostat rooms require a properly initialized schedule."); setLoading(false); return;
    }
    // Add more schedule validation if needed
    // --- End Validation ---

    try {
      let response;
      if (isEditMode) {
        // Use initialData.roomId for the PUT request URL
        response = await updateRoom(initialData.roomId, roomPayload);
      } else {
        response = await addRoom(roomPayload);
      }
      onSubmitSuccess(response.data); // Pass data back to parent
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'add'} room:`, err);
      setError(err?.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} room.`);
    } finally {
      setLoading(false);
    }
  };

  const sensorDevices = devices.filter(d => d.btSensorId !== undefined);

  return (
    // Wrap form content in DialogTitle, DialogContent, DialogActions
    <>
      <DialogTitle>{isEditMode ? `Edit Room: ${initialData?.name}` : "Add New Room"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Room ID: Required & editable for Add, disabled for Edit */}
        <TextField margin="dense" required={!isEditMode} disabled={isEditMode} fullWidth id="roomId" label="Unique Room ID" name="roomId" value={formData.roomId} onChange={handleChange} size="small" autoFocus={!isEditMode} />
        <TextField margin="dense" required fullWidth id="roomName" label="Room Name" name="name" value={formData.name} onChange={handleChange} size="small" autoFocus={isEditMode} />

        {/* Radiator Selection */}
        <FormControl margin="normal" fullWidth required size="small">
          <InputLabel id="radiator-select-label">Radiators</InputLabel>
          <Select
            labelId="radiator-select-label" id="radiatorDeviceIds" multiple name="radiatorDeviceIds"
            value={formData.radiatorDeviceIds} onChange={handleMultiSelectChange}
            input={<OutlinedInput label="Radiators" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const device = devices.find(d => d.id === value);
                  return <Chip key={value} label={device ? `${device.name} (${value})` : value} size="small" />;
                })}
              </Box>
            )}
            MenuProps={MenuProps} disabled={loadingDevices}
          >
            {loadingDevices ? <MenuItem disabled>Loading devices...</MenuItem> :
             devices.length === 0 ? <MenuItem disabled>No devices found</MenuItem> :
             devices.map((device) => (
              <MenuItem key={device.id} value={device.id}>
                <Checkbox checked={formData.radiatorDeviceIds.indexOf(device.id) > -1} />
                <ListItemText primary={`${device.name} (${device.id})`} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Control Mode Selection */}
        <FormControl margin="normal" fullWidth required size="small">
          <InputLabel id="control-mode-label">Control Mode</InputLabel>
          <Select labelId="control-mode-label" id="controlMode" name="controlMode" value={formData.controlMode} label="Control Mode" onChange={handleChange}>
            <MenuItem value={"schedule"}>Schedule Only</MenuItem>
            <MenuItem value={"thermostat"}>Thermostat (Uses Sensor & Schedule)</MenuItem>
          </Select>
        </FormControl>

        {/* Thermostat Specific Fields */}
        {formData.controlMode === 'thermostat' && (
          <Box sx={{ border: '1px dashed grey', p: 2, mt: 1, borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Thermostat Settings</Typography>
            <FormControl margin="dense" fullWidth required size="small" disabled={loadingDevices || sensorDevices.length === 0}>
              <InputLabel id="sensor-device-label">Temperature Sensor Device</InputLabel>
              <Select labelId="sensor-device-label" id="sensorDeviceId" name="sensorDeviceId" value={formData.sensorDeviceId} label="Temperature Sensor Device" onChange={handleChange}>
                 {loadingDevices ? <MenuItem disabled>Loading...</MenuItem> :
                  sensorDevices.length === 0 ? <MenuItem disabled>No devices with BT sensors found</MenuItem> :
                  sensorDevices.map((device) => ( <MenuItem key={device.id} value={device.id}> {`${device.name} (Sensor ID: ${device.btSensorId})`} </MenuItem> ))}
              </Select>
            </FormControl>
            <TextField margin="dense" required fullWidth id="targetTempC" label="Target Temperature (°C)" name="targetTempC" type="number" value={formData.targetTempC} onChange={handleChange} size="small" inputProps={{ step: "0.5" }} />
            <TextField margin="dense" required fullWidth id="hysteresisC" label="Hysteresis (°C)" name="hysteresisC" type="number" value={formData.hysteresisC} onChange={handleChange} size="small" inputProps={{ step: "0.1", min: "0.1" }} />
          </Box>
        )}

         {/* Schedule Editor (Included directly in the form for simplicity here) */}
         {/* If schedule editing becomes very complex, it could be its own component */}
         <Box sx={{ border: '1px dashed grey', p: 2, mt: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Heating Schedule</Typography>
              {Object.keys(formData.schedule).map(day => (
                  <Box key={day} mb={2}>
                      <Typography variant="overline">{day.toUpperCase()}</Typography>
                      {formData.schedule[day].length === 0 && ( <Typography variant="caption" display="block" color="text.secondary" sx={{ml: 1}}> No slots defined. </Typography> )}
                      {formData.schedule[day].map((slot, index) => (
                          <Grid container spacing={1} key={index} alignItems="center" mb={0.5}>
                              <Grid item xs={5} sm={3}> <TextField label="Start Time" type="time" size="small" fullWidth value={slot.startTime} onChange={(e) => handleScheduleChange(day, index, 'startTime', e.target.value)} InputLabelProps={{ shrink: true }} /> </Grid>
                              <Grid item xs={5} sm={3}> <TextField label="End Time" type="time" size="small" fullWidth value={slot.endTime} onChange={(e) => handleScheduleChange(day, index, 'endTime', e.target.value)} InputLabelProps={{ shrink: true }} /> </Grid>
                              
                              {/* Show temperature field for thermostat rooms */}
                              {formData.controlMode === 'thermostat' && (
                                  <Grid item xs={5} sm={2}>
                                      <TextField 
                                          label="Temp °C" 
                                          type="number" 
                                          size="small" 
                                          fullWidth
                                          value={slot.targetTempC || ""}
                                          onChange={(e) => handleScheduleTempChange(day, index, e.target.value)}
                                          InputProps={{
                                              inputProps: { min: 5, max: 30, step: 0.5 },
                                              endAdornment: "°C"
                                          }}
                                      />
                                  </Grid>
                              )}
                              
                              <Grid item xs={2} sm={formData.controlMode === 'thermostat' ? 1 : 3}> <Chip label="Rads" size="small" color="success" variant="outlined" /> </Grid>
                              <Grid item xs={12} sm={3} textAlign="right"> <IconButton size="small" onClick={() => handleRemoveScheduleSlot(day, index)} aria-label="delete time slot"> <DeleteIcon fontSize="small"/> </IconButton> </Grid>
                          </Grid>
                      ))}
                       <Button size="small" onClick={() => handleAddScheduleSlot(day)}>+ Add Time Slot for {day.toUpperCase()}</Button>
                      <Divider sx={{mt: 1}}/>
                  </Box>
              ))}
         </Box>

      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || loadingDevices}>
          {loading ? <CircularProgress size={24} /> : (isEditMode ? "Save Changes" : "Add Room")}
        </Button>
      </DialogActions>
    </>
  );
};

export default RoomForm;
