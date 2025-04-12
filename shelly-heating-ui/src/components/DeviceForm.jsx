// src/components/DeviceForm.js (Rename from AddDeviceForm.js)
import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { addDevice, updateDevice } from "../services/api";

// Pass isEditMode, initialData, onSubmitSuccess, onCancel props
const DeviceForm = ({
  isEditMode = false,
  initialData = null,
  onSubmitSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    ip: "",
    relayIndex: "0",
    hasBtSensor: false,
    btSensorId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // No success message inside the form, handle in parent dialog

  // Pre-fill form if editing
  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        id: initialData.id || "",
        name: initialData.name || "",
        ip: initialData.ip || "",
        relayIndex: initialData.relayIndex?.toString() || "0",
        hasBtSensor: initialData.btSensorId !== undefined,
        btSensorId: initialData.btSensorId?.toString() || "",
      });
    } else {
      // Reset for Add mode
      setFormData({
        id: "",
        name: "",
        ip: "",
        relayIndex: "0",
        hasBtSensor: false,
        btSensorId: "",
      });
    }
  }, [isEditMode, initialData]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "hasBtSensor" && !checked) {
      setFormData((prev) => ({ ...prev, btSensorId: "" }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // --- Payload construction and validation (similar to AddDeviceForm) ---
    const devicePayload = {
      // Base required fields
      name: formData.name,
      ip: formData.ip,
      relayIndex: parseInt(formData.relayIndex, 10), // Ensure number
    };
    // Add ID only if creating
    if (!isEditMode) {
      devicePayload.id = formData.id;
    }

    // --- Validation ---
    // Validate base required fields
    if (
      (!isEditMode && !devicePayload.id) ||
      !devicePayload.name ||
      !devicePayload.ip ||
      isNaN(devicePayload.relayIndex)
    ) {
      setError(
        "Please fill in all required fields (ID, Name, IP, Relay Index)."
      );
      setLoading(false);
      return;
    }
    if (devicePayload.relayIndex < 0) {
      setError("Relay Index cannot be negative.");
      setLoading(false);
      return;
    }
    // --- BT Sensor specific validation and payload addition ---
    if (formData.hasBtSensor) {
      // If checkbox is checked, the ID field MUST be filled and be a valid number
      if (!formData.btSensorId) {
        setError("BT Sensor ID is required when 'Has BT Sensor' is checked.");
        setLoading(false);
        return;
      }
      const sensorIdNum = parseInt(formData.btSensorId, 10);
      if (isNaN(sensorIdNum)) {
        setError("BT Sensor ID must be a valid number.");
        setLoading(false);
        return;
      }
      // Add the valid sensor ID to the payload
      devicePayload.btSensorId = sensorIdNum;
    } else if (isEditMode) {
      // If editing AND the checkbox is *unchecked*, we need to signal removal.
      // Send 'null' which the backend PUT handler understands as "remove this field".
      devicePayload.btSensorId = null;
    }

    // --- API Call ---
    try {
      let response;
      if (isEditMode) {
        // Use initialData.id for the PUT request URL
        response = await updateDevice(initialData.id, devicePayload);
      } else {
        // Use the full payload (including id) for POST
        response = await addDevice(devicePayload);
      }
      onSubmitSuccess(response.data); // Pass data back to parent
    } catch (err) {
      console.error(`Failed to ${isEditMode ? "update" : "add"} device:`, err);
      setError(
        err?.response?.data?.message ||
          `Failed to ${isEditMode ? "update" : "add"} device.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    // Removed Box form wrapper, assuming Dialog provides structure
    <>
      <DialogTitle>
        {isEditMode ? `Edit Device: ${initialData?.name}` : "Add New Device"}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {/* ID field only shown and required when adding */}
        {!isEditMode && (
          <TextField
            margin="dense"
            required
            fullWidth
            id="deviceId"
            label="Unique Device ID"
            name="id"
            value={formData.id}
            onChange={handleChange}
            autoFocus
            size="small"
          />
        )}
        {/* ID field shown but disabled when editing */}
        {isEditMode && (
          <TextField
            margin="dense"
            disabled
            fullWidth
            id="deviceId"
            label="Device ID"
            name="id"
            value={formData.id}
            size="small"
          />
        )}
        <TextField
          margin="dense"
          required
          fullWidth
          id="deviceName"
          label="Device Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          size="small"
          autoFocus={isEditMode}
        />
        <TextField
          margin="dense"
          required
          fullWidth
          id="deviceIp"
          label="IP Address"
          name="ip"
          value={formData.ip}
          onChange={handleChange}
          size="small"
        />
        <TextField
          margin="dense"
          required
          fullWidth
          id="relayIndex"
          label="Relay Index"
          name="relayIndex"
          type="number"
          value={formData.relayIndex}
          onChange={handleChange}
          size="small"
          InputProps={{ inputProps: { min: 0 } }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.hasBtSensor}
              onChange={handleChange}
              name="hasBtSensor"
            />
          }
          label="Has attached BT Sensor?"
        />
        {formData.hasBtSensor && (
          <TextField
            margin="dense"
            required={formData.hasBtSensor}
            fullWidth
            id="btSensorId"
            label="BT Sensor ID"
            name="btSensorId"
            type="number"
            value={formData.btSensorId}
            onChange={handleChange}
            size="small"
            InputProps={{ inputProps: { min: 0 } }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? (
            <CircularProgress size={24} />
          ) : isEditMode ? (
            "Save Changes"
          ) : (
            "Add Device"
          )}
        </Button>
      </DialogActions>
    </>
  );
};

export default DeviceForm;
