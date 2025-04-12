// src/services/api.js
import axios from "axios";

// Use environment variable for base URL
const API_BASE_URL = "http://192.168.0.18:3001"; // Fallback for local dev
console.log("Using API Base URL:", API_BASE_URL); // Add log for debugging


const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Device Endpoints ---
export const getDevices = () => apiClient.get("/devices");
export const getDevice = (deviceId) => apiClient.get(`/devices/${deviceId}`); // New
export const addDevice = (deviceData) => apiClient.post("/devices", deviceData);
export const updateDevice = (deviceId, deviceData) => apiClient.put(`/devices/${deviceId}`, deviceData); // New
export const deleteDevice = (deviceId) => apiClient.delete(`/devices/${deviceId}`); // New
export const getDeviceStatus = (deviceId) => apiClient.get(`/devices/${deviceId}/status`);
export const getDeviceSensorData = (deviceId) => apiClient.get(`/devices/${deviceId}/sensor`);

// --- Room Endpoints ---
export const getRooms = () => apiClient.get("/rooms");
export const addRoom = (roomData) => apiClient.post("/rooms", roomData);
export const getRoomDetails = (roomId) => apiClient.get(`/rooms/${roomId}`);
export const updateRoom = (roomId, roomData) => apiClient.put(`/rooms/${roomId}`, roomData); // New (for full update)
export const deleteRoom = (roomId) => apiClient.delete(`/rooms/${roomId}`); // New (if not already added)
export const setRoomTargetTemperature = (roomId, targetTempC) => apiClient.put(`/rooms/${roomId}/target`, { targetTempC });
export const setRoomSchedule = (roomId, schedule) => apiClient.put(`/rooms/${roomId}/schedule`, { schedule });

export default apiClient;
