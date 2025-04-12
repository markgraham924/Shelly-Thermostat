// src/pages/SchedulePage.js
import React, { useState, useEffect } from "react";
import {
  Container, Typography, Box, Select, MenuItem, FormControl, InputLabel, Paper, Alert
} from "@mui/material";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorDisplay from "../components/ErrorDisplay";
import ScheduleEditor from "../components/ScheduleEditor"; // We'll create this next
import { getRooms, getRoomDetails } from "../services/api";

const SchedulePage = () => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRoomData, setSelectedRoomData] = useState(null); // Store full room data
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingRoomDetails, setLoadingRoomDetails] = useState(false);
  const [errorRooms, setErrorRooms] = useState(null);
  const [errorRoomDetails, setErrorRoomDetails] = useState(null);

  // Fetch list of all rooms for the dropdown
  useEffect(() => {
    const fetchRoomsList = async () => {
      setLoadingRooms(true);
      setErrorRooms(null);
      try {
        const response = await getRooms();
        setRooms(response.data || []);
      } catch (err) {
        console.error("Failed to fetch rooms list:", err);
        setErrorRooms(err);
        setRooms([]);
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRoomsList();
  }, []);

  // Fetch details (including schedule) when a room is selected
  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoomData(null); // Clear details if no room is selected
      return;
    }

    const fetchRoomData = async () => {
      setLoadingRoomDetails(true);
      setErrorRoomDetails(null);
      setSelectedRoomData(null); // Clear previous data while loading
      try {
        const response = await getRoomDetails(selectedRoomId);
        
        // Initialize schedule if it's null but should have one (for thermostat rooms)
        if (response.data && 
            (response.data.controlMode === 'schedule' || response.data.controlMode === 'thermostat') && 
            !response.data.schedule) {
          response.data.schedule = {
            mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
          };
        }
        
        setSelectedRoomData(response.data);
      } catch (err) {
        console.error(`Failed to fetch details for room ${selectedRoomId}:`, err);
        setErrorRoomDetails(err);
      } finally {
        setLoadingRoomDetails(false);
      }
    };
    fetchRoomData();
  }, [selectedRoomId]); // Re-run when selectedRoomId changes

  const handleRoomChange = (event) => {
    setSelectedRoomId(event.target.value);
  };

  // Callback for when schedule is saved in the editor
  const handleScheduleSaveSuccess = (updatedSchedule) => {
     // Update local state immediately for better UX
     setSelectedRoomData(prev => ({...prev, schedule: updatedSchedule}));
     // Optionally show a success message here
  }

  // src/pages/SchedulePage.js

  return (
    
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Manage Schedules
      </Typography>

      {loadingRooms && <LoadingSpinner />}
      {errorRooms && <ErrorDisplay error={errorRooms} />}

      {!loadingRooms && !errorRooms && (
        <FormControl fullWidth margin="normal" size="small">
          <InputLabel id="room-select-label">Select Room</InputLabel>
          <Select
            labelId="room-select-label"
            id="room-select"
            value={selectedRoomId}
            label="Select Room"
            onChange={handleRoomChange}
            disabled={rooms.length === 0}
          >
            <MenuItem value="">
              <em>-- Select a Room --</em>
            </MenuItem>
            {rooms.map((room) => (
              <MenuItem key={room.roomId} value={room.roomId}>
                {room.name} ({room.roomId})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Display Schedule Editor when a room is selected and details are loaded */}
      {selectedRoomId && (
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          {loadingRoomDetails && <LoadingSpinner />}
          {errorRoomDetails && <ErrorDisplay error={errorRoomDetails} />}
          {!loadingRoomDetails && !errorRoomDetails && selectedRoomData && (
            <>
              <Typography variant="h6" component="h2" gutterBottom>
                Editing Schedule for: {selectedRoomData.name}
              </Typography>
              {!selectedRoomData.schedule ? (
                <Alert severity="warning">This room data does not seem to contain a schedule.</Alert>
              ) : selectedRoomData.controlMode !== 'schedule' && selectedRoomData.controlMode !== 'thermostat' ? (
                <Alert severity="info">
                  Schedule editing is only available for rooms in Schedule or Thermostat mode. 
                  This room is currently in "{selectedRoomData.controlMode}" mode.
                </Alert>
              ) : (
                <ScheduleEditor
                  roomId={selectedRoomData.roomId}
                  initialSchedule={selectedRoomData.schedule}
                  onSaveSuccess={handleScheduleSaveSuccess} // Pass callback
                  roomRadiatorIds={selectedRoomData.radiatorDeviceIds} // Pass radiator IDs from room data
                  roomControlMode={selectedRoomData.controlMode} // Optionally also pass the control mode
                />
              )}
            </>
          )}
           {!loadingRoomDetails && !errorRoomDetails && !selectedRoomData && selectedRoomId && (
             <Alert severity="info">Loading room details...</Alert> // Should be covered by loading state, but as fallback
           )}
        </Paper>
      )}
       {!selectedRoomId && !loadingRooms && (
         <Typography align="center" color="text.secondary" sx={{mt: 4}}>
            Please select a room above to view or edit its schedule.
         </Typography>
       )}
    </Container>
  );
};

export default SchedulePage;
