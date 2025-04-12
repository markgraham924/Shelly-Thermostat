// src/components/RoomCard.js
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  TextField,
  Divider,
  Collapse,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from "@mui/material";
import {
  Thermostat as ThermostatIcon,
  Schedule as ScheduleIcon,
  PowerSettingsNew as PowerIcon,
  PowerOff as PowerOffIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  InfoOutlined as InfoIcon,
  ErrorOutline as ErrorIcon,
  Sensors as SensorIcon,
  LocalFireDepartment as LocalFireDepartmentIcon,
  AcUnit as AcUnitIcon
} from "@mui/icons-material";
import LoadingSpinner from "./LoadingSpinner";
import { getDeviceStatus, getDeviceSensorData, setRoomTargetTemperature } from "../services/api";

const RoomCard = ({ room, boostStatus, onBoost, onCancelBoost }) => {
  const [radiatorStatuses, setRadiatorStatuses] = useState({}); // { deviceId: { status: data, loading: bool, error: obj } }
  const [sensorData, setSensorData] = useState({ data: null, loading: false, error: null });
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [editableTargetTemp, setEditableTargetTemp] = useState(room.targetTempC || "");
  const [isExpanded, setIsExpanded] = useState(false); // State for radiator list expansion
  const [openBoostDialog, setOpenBoostDialog] = useState(false);
  const [boostDuration, setBoostDuration] = useState(30); // Default 30 minutes

  const fetchRadiatorStatus = useCallback(async (deviceId) => {
    setRadiatorStatuses((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], loading: true, error: null },
    }));
    try {
      const response = await getDeviceStatus(deviceId);
      setRadiatorStatuses((prev) => ({
        ...prev,
        [deviceId]: { status: response.data, loading: false, error: null },
      }));
    } catch (error) {
      console.error(`Error fetching status for radiator ${deviceId}:`, error);
      setRadiatorStatuses((prev) => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], loading: false, error: error },
      }));
    }
  }, []); // Empty dependency array, function doesn't change

  const fetchSensorData = useCallback(async () => {
    if (room.controlMode !== "thermostat" || !room.sensorDeviceId) return;

    setSensorData({ data: null, loading: true, error: null });
    try {
      const response = await getDeviceSensorData(room.sensorDeviceId);
      setSensorData({ data: response.data, loading: false, error: null });
    } catch (error) {
      console.error(`Error fetching sensor data for room ${room.roomId}:`, error);
      setSensorData({ data: null, loading: false, error: error });
    }
  }, [room.controlMode, room.sensorDeviceId, room.roomId]); // Dependencies for sensor fetch

  // Fetch all statuses on mount and periodically
  useEffect(() => {
    const fetchAllData = () => {
        console.log(`Fetching data for room: ${room.name}`);
        room.radiatorDeviceIds.forEach((id) => fetchRadiatorStatus(id));
        if (room.controlMode === "thermostat") {
            fetchSensorData();
        }
    }
    fetchAllData(); // Initial fetch
    const intervalId = setInterval(fetchAllData, 30 * 1000); // Refresh every 30 seconds
    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [room.radiatorDeviceIds, fetchRadiatorStatus, room.controlMode, fetchSensorData, room.name]); // Add room.name to dependencies if needed

  const handleEditTarget = () => {
    setEditableTargetTemp(room.targetTempC || "");
    setIsEditingTarget(true);
  };

  const handleCancelEdit = () => {
    setIsEditingTarget(false);
  };

  const handleSaveTarget = async () => {
    const newTemp = parseFloat(editableTargetTemp);
    if (isNaN(newTemp)) {
      alert("Invalid temperature value"); // Basic validation
      return;
    }
    try {
      // Optimistic UI update (optional)
      // room.targetTempC = newTemp; // Be careful mutating props directly

      await setRoomTargetTemperature(room.roomId, newTemp);
      // Refetch room data or update state based on API response if needed
      // For now, we assume the backend loop will handle it, but a direct update is better UX
      room.targetTempC = newTemp; // Update local view (prop mutation - use with caution or refetch)
      setIsEditingTarget(false);
    } catch (error) {
      console.error("Failed to update target temperature:", error);
      alert(`Failed to update target temperature: ${error?.response?.data?.message || error.message}`);
      // Revert optimistic update if needed
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleBoostClick = () => {
    setOpenBoostDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenBoostDialog(false);
  };

  const handleConfirmBoost = () => {
    onBoost(room.roomId, boostDuration);
    setOpenBoostDialog(false);
  };

  const handleCancelBoost = () => {
    onCancelBoost(room.roomId);
  };

  // Calculate overall room status (simplistic: on if any radiator is on)
  const isRoomOn = Object.values(radiatorStatuses).some(
    (rs) => rs.status?.output === true
  );

  const isBoosted = !!boostStatus;

  return (
    <Card sx={{ m: 1, mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" component="div">
            {room.name}
          </Typography>
          <Chip
            icon={room.controlMode === "thermostat" ? <ThermostatIcon /> : <ScheduleIcon />}
            label={room.controlMode === "thermostat" ? "Thermostat" : "Schedule"}
            size="small"
            color={isRoomOn ? "success" : "default"} // Color chip based on overall status
          />
        </Box>

        {/* Thermostat Info */}
        {room.controlMode === "thermostat" && (
          <Box mb={1} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
             <Tooltip title="Current Temperature">
                <Chip
                    icon={<SensorIcon fontSize="small"/>}
                    label={
                        sensorData.loading ? "Loading..." :
                        sensorData.error ? "Error" :
                        sensorData.data?.value !== undefined ? `${sensorData.data.value}°C` : "N/A"
                    }
                    size="small"
                    variant="outlined"
                    color={sensorData.error ? "error" : "info"}
                />
             </Tooltip>

            {!isEditingTarget ? (
              <Box display="flex" alignItems="center">
                 <Tooltip title="Target Temperature">
                    <Chip
                        icon={<ThermostatIcon fontSize="small"/>}
                        label={`${room.targetTempC}°C`}
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={handleEditTarget} // Allow clicking chip to edit
                        sx={{ cursor: 'pointer'}}
                    />
                 </Tooltip>
                <IconButton size="small" onClick={handleEditTarget} aria-label="edit target temperature">
                  <EditIcon fontSize="inherit" />
                </IconButton>
              </Box>
            ) : (
              <Box display="flex" alignItems="center" gap={0.5}>
                <TextField
                  type="number"
                  size="small"
                  variant="outlined"
                  value={editableTargetTemp}
                  onChange={(e) => setEditableTargetTemp(e.target.value)}
                  sx={{ width: "80px" }}
                  inputProps={{ step: "0.5" }}
                />
                <IconButton size="small" onClick={handleSaveTarget} color="primary" aria-label="save target temperature">
                  <SaveIcon fontSize="inherit" />
                </IconButton>
                <IconButton size="small" onClick={handleCancelEdit} aria-label="cancel edit">
                  <CancelIcon fontSize="inherit" />
                </IconButton>
              </Box>
            )}
          </Box>
        )}

        {/* Schedule Info (Placeholder) */}
        {room.controlMode === "schedule" && (
          <Box mb={1}>
            <Typography variant="body2" color="text.secondary">
              Controlled by schedule. {/* TODO: Add schedule display/edit */}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Radiator List Toggle */}
        <Box display="flex" justifyContent="space-between" alignItems="center" onClick={toggleExpand} sx={{ cursor: 'pointer' }}>
            <Typography variant="overline" color="text.secondary">
                Radiators ({room.radiatorDeviceIds.length})
            </Typography>
            <IconButton size="small" aria-label={isExpanded ? "collapse radiators" : "expand radiators"}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
        </Box>

        {/* Collapsible Radiator List */}
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List dense disablePadding>
            {room.radiatorDeviceIds.map((deviceId) => {
                const rState = radiatorStatuses[deviceId];
                const isLoading = rState?.loading;
                const error = rState?.error;
                const statusData = rState?.status;
                const isOn = statusData?.output === true;
                const power = statusData?.apower?.toFixed(1); // Active power

                // Find device name (ideally pass devices list down or fetch names)
                // Placeholder: just show ID for now
                const deviceName = deviceId;

                return (
                <ListItem key={deviceId} disableGutters>
                    <ListItemIcon sx={{ minWidth: '32px' }}>
                    {isLoading ? (
                        <LoadingSpinner size={18} />
                    ) : error ? (
                        <Tooltip title={`Error: ${error?.response?.data?.message || error.message}`}>
                            <ErrorIcon color="error" fontSize="small"/>
                        </Tooltip>
                    ) : isOn ? (
                        <PowerIcon color="success" fontSize="small"/>
                    ) : (
                        <PowerOffIcon color="action" fontSize="small"/>
                    )}
                    </ListItemIcon>
                    <ListItemText
                        primary={deviceName}
                        secondary={!isLoading && !error && power !== undefined ? `${power} W` : error ? 'Update failed' : ' '}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    {/* Add manual control button here if needed later */}
                </ListItem>
                );
            })}
            </List>
        </Collapse>

        {/* Boost Status and Controls */}
        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          {isBoosted ? (
            <>
              <Box display="flex" alignItems="center">
                <LocalFireDepartmentIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="body2" color="error.main">
                  Boosted for {boostStatus.remainingMinutes} more minutes
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                onClick={handleCancelBoost}
              >
                Cancel Boost
              </Button>
            </>
          ) : (
            <Button 
              variant="contained" 
              color="primary" 
              size="small"
              startIcon={<LocalFireDepartmentIcon />}
              onClick={handleBoostClick}
            >
              Boost
            </Button>
          )}
        </Box>

      </CardContent>

      {/* Boost Duration Dialog */}
      <Dialog open={openBoostDialog} onClose={handleCloseDialog}>
        <DialogTitle>Boost {room.name}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Duration</InputLabel>
            <Select
              value={boostDuration}
              onChange={(e) => setBoostDuration(e.target.value)}
              label="Duration"
            >
              <MenuItem value={15}>15 minutes</MenuItem>
              <MenuItem value={30}>30 minutes</MenuItem>
              <MenuItem value={60}>1 hour</MenuItem>
              <MenuItem value={120}>2 hours</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmBoost} variant="contained" color="primary">
            Start Boost
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default RoomCard;
