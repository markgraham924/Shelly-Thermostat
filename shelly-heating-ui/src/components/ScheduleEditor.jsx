// src/components/ScheduleEditor.js
import React, { useState, useEffect } from 'react';
import {
    Box, TextField, Button, CircularProgress, Alert,
    Typography, Divider, IconButton, Grid, Chip, Select, MenuItem,
    InputLabel, FormControl, OutlinedInput, Checkbox, ListItemText,
    Paper, // Ensure Paper is imported
    FormGroup // Ensure FormGroup is imported
    // Removed Switch, FormControlLabel as they are no longer needed here
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { setRoomSchedule } from "../services/api";
import { getDevices } from "../services/api"; // Need all devices to get names

// --- Helper Functions and Constants ---

const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Default empty schedule structure
const defaultSchedule = () => ({
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
});

// Helper to deep copy schedule
const deepCopySchedule = (schedule) => {
    if (!schedule) return defaultSchedule();
    try {
        const base = defaultSchedule();
        const parsed = JSON.parse(JSON.stringify(schedule || {}));
        // Ensure all days exist, even if empty, after parsing
        for (const day of daysOfWeek) {
            if (!parsed[day]) {
                parsed[day] = [];
            }
        }
        return { ...base, ...parsed };
    } catch (e) {
        console.error("Error deep copying schedule:", e, "Input schedule:", schedule);
        return defaultSchedule();
    }
};

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
// --- End Helpers ---


// roomControlMode prop is kept for determining default slot structure on add
const ScheduleEditor = ({ roomId, initialSchedule, onSaveSuccess, roomControlMode, roomRadiatorIds = [] }) => {
    const [editableSchedule, setEditableSchedule] = useState(defaultSchedule);
    const [allDevices, setAllDevices] = useState([]); // Store all devices for name lookup
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [sourceDay, setSourceDay] = useState('');
    const [targetDays, setTargetDays] = useState([]);


    // Fetch all devices once for name lookup
    useEffect(() => {
        getDevices()
            .then(res => setAllDevices(res.data || [])
            .catch(err => console.error("Failed to fetch all devices for names", err)));
    }, []);

    // Sync with initialSchedule prop
    useEffect(() => {
        console.log("ScheduleEditor useEffect triggered. initialSchedule:", initialSchedule);
        if (initialSchedule) {
            setEditableSchedule(deepCopySchedule(initialSchedule));
        } else {
            setEditableSchedule(defaultSchedule());
        }
        // Reset other related state when the schedule source changes
        setSuccess(null);
        setError(null);
        setSourceDay('');
        setTargetDays([]);
    }, [initialSchedule, roomId]);

    // --- Schedule Slot Handlers ---
    const handleAddScheduleSlot = (day) => {
        // Always create a slot with enabledRadiatorIds, default to all enabled
        const newSlot = {
            startTime: '09:00',
            endTime: '17:00',
            enabledRadiatorIds: [...roomRadiatorIds], // Default to all rads enabled
            targetTempC: roomControlMode === 'thermostat' ? 10 : undefined // Default temperature if thermostat mode
        };
        setEditableSchedule(prev => ({
            ...prev,
            [day]: [...(prev[day] || []), newSlot]
        }));
        setSuccess(null); // Clear success message on edit
    };

    const handleRemoveScheduleSlot = (day, index) => {
        setEditableSchedule(prev => ({
            ...prev,
            [day]: (prev[day] || []).filter((_, i) => i !== index)
        }));
        setSuccess(null);
    };

    // Generic change handler for time inputs
    const handleTimeChange = (day, index, field, value) => {
        setEditableSchedule(prev => {
            const updatedDaySchedule = [...(prev[day] || [])];
            if (updatedDaySchedule[index]) {
                updatedDaySchedule[index] = { ...updatedDaySchedule[index], [field]: value };
            }
            return { ...prev, [day]: updatedDaySchedule };
        });
        setSuccess(null);
    };

    // Add handler for temperature changes
    const handleTempChange = (day, index, value) => {
        setEditableSchedule(prev => {
            const updatedDaySchedule = [...(prev[day] || [])];
            if (updatedDaySchedule[index]) {
                updatedDaySchedule[index] = { 
                    ...updatedDaySchedule[index], 
                    targetTempC: value !== "" ? parseFloat(value) : undefined 
                };
            }
            return { ...prev, [day]: updatedDaySchedule };
        });
        setSuccess(null);
    };

    // Specific handler for thermostat radiator selection within a slot
    const handleRadiatorSelectionChange = (day, index, deviceId) => {
        setEditableSchedule(prev => {
            const updatedDaySchedule = [...(prev[day] || [])];
            if (updatedDaySchedule[index]) {
                // Ensure enabledRadiatorIds exists, default to empty array if not
                const currentEnabled = updatedDaySchedule[index].enabledRadiatorIds || [];
                const isCurrentlyEnabled = currentEnabled.includes(deviceId);
                let newEnabledRadiatorIds;
                if (isCurrentlyEnabled) {
                    newEnabledRadiatorIds = currentEnabled.filter(id => id !== deviceId);
                } else {
                    newEnabledRadiatorIds = [...currentEnabled, deviceId];
                }
                updatedDaySchedule[index] = { ...updatedDaySchedule[index], enabledRadiatorIds: newEnabledRadiatorIds };
            }
            return { ...prev, [day]: updatedDaySchedule };
        });
        setSuccess(null);
    };
    // --- End Slot Handlers ---

    // --- Copy Schedule Handler ---
    const handleCopySchedule = () => {
        if (!sourceDay || targetDays.length === 0) {
            setError("Please select source and target days.");
            return;
        }
        setError(null);
        setSuccess(null);
        const sourceSlots = editableSchedule[sourceDay] || [];
        const copiedSlots = JSON.parse(JSON.stringify(sourceSlots)); // Deep copy

        setEditableSchedule(prev => {
            const newSchedule = { ...prev };
            targetDays.forEach(targetDay => {
                newSchedule[targetDay] = copiedSlots;
            });
            return newSchedule;
        });
        setSuccess(`Schedule from ${sourceDay.toUpperCase()} copied to ${targetDays.map(d => d.toUpperCase()).join(', ')}.`);
    };
    // --- End Copy Handler ---

    // --- Save Schedule Handler ---
    const handleSaveSchedule = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            // Ensure all days are present before saving, even if empty
            const scheduleToSave = { ...defaultSchedule(), ...editableSchedule };
            await setRoomSchedule(roomId, { schedule: scheduleToSave });
            setSuccess(`Schedule for room ${roomId} saved successfully!`);
            if (onSaveSuccess) {
                onSaveSuccess(scheduleToSave); // Pass the saved schedule back up
            }
        } catch (err) {
            console.error("Failed to save schedule:", err);
            setError(err?.response?.data?.message || "Failed to save schedule.");
        } finally {
            setLoading(false);
        }
    };
    // --- End Save Handler ---

    // Helper to get device name
    const getDeviceName = (id) => allDevices.find(d => d.id === id)?.name || id;

    // --- DEBUG LOG ---
    // Check the value of the prop as received by this component instance
    console.log("ScheduleEditor received roomRadiatorIds:", roomRadiatorIds);
    // --- END DEBUG LOG ---

    return (
        <Box component="div" sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

            {/* --- Copy Schedule UI --- */}
            <Box sx={{ border: '1px dashed lightgrey', p: 2, mb: 3, borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>Copy Schedule</Typography>
                <Grid container spacing={2} alignItems="center">
                    {/* Source Day Select */}
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="copy-from-label">Copy From</InputLabel>
                            <Select
                                labelId="copy-from-label"
                                value={sourceDay}
                                label="Copy From"
                                onChange={(e) => setSourceDay(e.target.value)}
                            >
                                <MenuItem value=""><em>-- Select Source Day --</em></MenuItem>
                                {daysOfWeek.map(day => (
                                    <MenuItem key={day} value={day}>{day.toUpperCase()}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    {/* Target Days Select */}
                    <Grid item xs={12} sm={5}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="copy-to-label">Copy To</InputLabel>
                            <Select
                                labelId="copy-to-label"
                                multiple
                                value={targetDays}
                                onChange={(e) => setTargetDays(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                                input={<OutlinedInput label="Copy To" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => (
                                            <Chip key={value} label={value.toUpperCase()} size="small" />
                                        ))}
                                    </Box>
                                )}
                                MenuProps={MenuProps}
                            >
                                {daysOfWeek.map((day) => (
                                    <MenuItem key={day} value={day} disabled={day === sourceDay}>
                                        <Checkbox checked={targetDays.indexOf(day) > -1} />
                                        <ListItemText primary={day.toUpperCase()} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    {/* Copy Button */}
                    <Grid item xs={12} sm={3}>
                        <Button
                            variant="outlined"
                            size="medium"
                            fullWidth
                            onClick={handleCopySchedule}
                            disabled={!sourceDay || targetDays.length === 0}
                            startIcon={<ContentCopyIcon />}
                        >
                            Copy
                        </Button>
                    </Grid>
                </Grid>
            </Box>
            {/* --- End Copy Schedule UI --- */}


            {/* --- Daily Schedule Editor (ALWAYS Render Radiator Selection) --- */}
            {daysOfWeek.map(day => (
                <Box key={day} mb={2}>
                    <Typography variant="overline">{day.toUpperCase()}</Typography>
                     {(!editableSchedule[day] || editableSchedule[day].length === 0) && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ml: 1}}>
                            No slots defined.
                        </Typography>
                    )}

                    {editableSchedule[day]?.map((slot, index) => (
                        <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                            <Grid container spacing={1} alignItems="center">
                                {/* Time Inputs */}
                                <Grid item xs={6} sm={2}>
                                    <TextField
                                        label="Start" type="time" size="small" fullWidth
                                        value={slot.startTime || ''}
                                        onChange={(e) => handleTimeChange(day, index, 'startTime', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid item xs={6} sm={2}>
                                    <TextField
                                        label="End" type="time" size="small" fullWidth
                                        value={slot.endTime || ''}
                                        onChange={(e) => handleTimeChange(day, index, 'endTime', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>

                                {/* Target Temperature Input - Only show when room has a temperature sensor */}
                                {roomControlMode === 'thermostat' && (
                                    <Grid item xs={6} sm={2}>
                                        <TextField
                                            label="Temp °C"
                                            type="number"
                                            size="small"
                                            fullWidth
                                            value={slot.targetTempC || ""}
                                            onChange={(e) => handleTempChange(day, index, e.target.value)}
                                            InputProps={{
                                                inputProps: { 
                                                    min: 5, 
                                                    max: 30, 
                                                    step: 0.5 
                                                },
                                                endAdornment: "°C"
                                            }}
                                        />
                                    </Grid>
                                )}

                                {/* Radiator Selection (ALWAYS RENDERED) */}
                                <Grid item xs={10} sm={roomControlMode === 'thermostat' ? 5 : 7}>
                                    <FormControl component="fieldset" variant="standard" size="small" sx={{width: '100%'}}>
                                        <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                                            {roomControlMode === 'thermostat' 
                                                ? 'Select radiators to reach target temperature:' 
                                                : 'Select radiators to be active during this time slot:'}
                                        </Typography>
                                        <FormGroup row sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                            {/* Explicitly check prop before mapping */}
                                            {roomRadiatorIds && roomRadiatorIds.length > 0 ? (
                                                roomRadiatorIds.map(radId => (
                                                    <Chip
                                                        key={radId}
                                                        label={getDeviceName(radId)}
                                                        size="small"
                                                        clickable
                                                        color={slot.enabledRadiatorIds?.includes(radId) ? "success" : "default"}
                                                        variant={slot.enabledRadiatorIds?.includes(radId) ? "filled" : "outlined"}
                                                        onClick={() => handleRadiatorSelectionChange(day, index, radId)}
                                                    />
                                                ))
                                            ) : (
                                                <Typography variant="caption" sx={{ fontStyle: 'italic', width: '100%' }}>
                                                    No radiators assigned to this room in settings.
                                                </Typography>
                                            )}
                                        </FormGroup>
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
                                            Click on radiators to toggle them on (green) or off for this time period
                                        </Typography>
                                    </FormControl>
                                </Grid>

                                {/* Delete Button */}
                                <Grid item xs={2} sm={1} textAlign="right">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleRemoveScheduleSlot(day, index)}
                                        aria-label="delete time slot"
                                    >
                                        <DeleteIcon fontSize="small"/>
                                    </IconButton>
                                </Grid>
                            </Grid>
                        </Paper>
                    ))}
                     <Button size="small" onClick={() => handleAddScheduleSlot(day)}>
                        + Add Time Slot for {day.toUpperCase()}
                     </Button>
                    <Divider sx={{mt: 1}}/>
                </Box>
            ))}
            {/* --- End Daily Schedule Editor --- */}

            {/* --- Save Button --- */}
            <Button
                variant="contained"
                color="primary"
                onClick={handleSaveSchedule}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <SaveIcon />}
                sx={{ mt: 2 }}
            >
                Save Schedule
            </Button>
        </Box>
    );
};

export default ScheduleEditor;
