// src/pages/SettingsPage.js
import React, { useState, useEffect, useCallback } from "react";
import {
  Container, Typography, Box, Paper, Divider, List, ListItem, ListItemText,
  ListItemSecondaryAction, IconButton, Button, Dialog, Alert, Snackbar
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import DeviceForm from "../components/DeviceForm"; // Use the refactored form
import RoomForm from "../components/RoomForm";   // Assume you refactored AddRoomForm similarly
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorDisplay from "../components/ErrorDisplay";
import { getDevices, deleteDevice, getRooms, deleteRoom } from "../services/api";

const SettingsPage = () => {
  const [devices, setDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState({ devices: true, rooms: true });
  const [error, setError] = useState({ devices: null, rooms: null });
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null); // null for Add, device object for Edit
  const [editingRoom, setEditingRoom] = useState(null);     // null for Add, room object for Edit
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'device'/'room', id: '', name: '' }
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchAllData = useCallback(async () => {
    setLoading({ devices: true, rooms: true });
    setError({ devices: null, rooms: null });
    try {
      const [devicesRes, roomsRes] = await Promise.all([getDevices(), getRooms()]);
      setDevices(devicesRes.data || []);
      setRooms(roomsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch settings data:", err);
      // Set specific errors if possible, otherwise a general one
      setError({ devices: err, rooms: err });
    } finally {
      setLoading({ devices: false, rooms: false });
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Dialog Open Handlers ---
  const handleOpenDeviceDialog = (device = null) => {
    setEditingDevice(device); // null for Add, device object for Edit
    setIsDeviceDialogOpen(true);
  };
  const handleOpenRoomDialog = (room = null) => {
    setEditingRoom(room); // null for Add, room object for Edit
    setIsRoomDialogOpen(true);
  };
  const handleOpenDeleteDialog = (type, item) => {
    setItemToDelete({ type, id: type === 'device' ? item.id : item.roomId, name: item.name });
    setIsDeleteDialogOpen(true);
  };

  // --- Dialog Close Handlers ---
  const handleCloseDeviceDialog = () => setIsDeviceDialogOpen(false);
  const handleCloseRoomDialog = () => setIsRoomDialogOpen(false);
  const handleCloseDeleteDialog = () => setIsDeleteDialogOpen(false);

  // --- Form Submit Handlers ---
  const handleDeviceSubmitSuccess = (updatedOrNewDevice) => {
    setSnackbar({ open: true, message: `Device ${editingDevice ? 'updated' : 'added'} successfully!`, severity: 'success' });
    setIsDeviceDialogOpen(false);
    fetchAllData(); // Refetch lists
  };
  const handleRoomSubmitSuccess = (updatedOrNewRoom) => {
    setSnackbar({ open: true, message: `Room ${editingRoom ? 'updated' : 'added'} successfully!`, severity: 'success' });
    setIsRoomDialogOpen(false);
    fetchAllData(); // Refetch lists
  };

  // --- Delete Handler ---
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const { type, id, name } = itemToDelete;
    try {
      if (type === 'device') {
        await deleteDevice(id);
      } else if (type === 'room') {
        await deleteRoom(id);
      }
      setSnackbar({ open: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} '${name}' deleted successfully!`, severity: 'success' });
      fetchAllData(); // Refetch lists
    } catch (err) {
      console.error(`Failed to delete ${type}:`, err);
      setSnackbar({ open: true, message: `Failed to delete ${type}: ${err?.response?.data?.message || err.message}`, severity: 'error' });
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };


  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Settings
      </Typography>

      {/* Devices Section */}
      <Paper elevation={3} sx={{ p: { xs: 1, sm: 2 }, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" component="h2">
            Manage Devices
          </Typography>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => handleOpenDeviceDialog()}>
            Add Device
          </Button>
        </Box>
        {loading.devices && <LoadingSpinner />}
        {error.devices && !loading.devices && <ErrorDisplay error={error.devices} />}
        {!loading.devices && !error.devices && (
          <List dense>
            {devices.length === 0 && <ListItem><ListItemText primary="No devices found." /></ListItem>}
            {devices.map((device) => (
              <ListItem key={device.id} divider>
                <ListItemText
                  primary={device.name}
                  secondary={`ID: ${device.id} | IP: ${device.ip} | Relay: ${device.relayIndex}${device.btSensorId !== undefined ? ` | Sensor: ${device.btSensorId}` : ''}`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="edit" onClick={() => handleOpenDeviceDialog(device)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleOpenDeleteDialog('device', device)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* Rooms Section */}
      <Paper elevation={3} sx={{ p: { xs: 1, sm: 2 } }}>
         <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" component="h2">
            Manage Rooms
          </Typography>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => handleOpenRoomDialog()}>
            Add Room
          </Button>
        </Box>
         {loading.rooms && <LoadingSpinner />}
        {error.rooms && !loading.rooms && <ErrorDisplay error={error.rooms} />}
        {!loading.rooms && !error.rooms && (
          <List dense>
             {rooms.length === 0 && <ListItem><ListItemText primary="No rooms found." /></ListItem>}
             {rooms.map((room) => (
              <ListItem key={room.roomId} divider>
                <ListItemText
                  primary={room.name}
                  secondary={`ID: ${room.roomId} | Mode: ${room.controlMode} | Radiators: ${room.radiatorDeviceIds.length}${room.sensorDeviceId ? ` | Sensor: ${room.sensorDeviceId}` : ''}`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="edit" onClick={() => handleOpenRoomDialog(room)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleOpenDeleteDialog('room', room)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Device Add/Edit Dialog */}
      <Dialog open={isDeviceDialogOpen} onClose={handleCloseDeviceDialog} maxWidth="sm" fullWidth>
         {/* Render form only when dialog is open to reset state properly */}
         {isDeviceDialogOpen && (
            <DeviceForm
                isEditMode={!!editingDevice}
                initialData={editingDevice}
                onSubmitSuccess={handleDeviceSubmitSuccess}
                onCancel={handleCloseDeviceDialog}
            />
         )}
      </Dialog>

      {/* Room Add/Edit Dialog */}
       <Dialog open={isRoomDialogOpen} onClose={handleCloseRoomDialog} maxWidth="md" fullWidth>
         {/* Render form only when dialog is open */}
         {isRoomDialogOpen && (
            <RoomForm // Assuming you created/refactored this
                isEditMode={!!editingRoom}
                initialData={editingRoom}
                onSubmitSuccess={handleRoomSubmitSuccess}
                onCancel={handleCloseRoomDialog}
            />
         )}
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDeleteConfirm}
        itemName={itemToDelete?.name || ''}
        itemType={itemToDelete?.type || 'item'}
      />

     {/* Snackbar for feedback */}
     <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Container>
  );
};

export default SettingsPage;
