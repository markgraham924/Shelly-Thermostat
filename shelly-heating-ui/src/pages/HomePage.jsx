// src/pages/HomePage.js
import React, { useState, useEffect } from "react";
import { Container, Typography, Box } from "@mui/material";
import RoomCard from "../components/RoomCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorDisplay from "../components/ErrorDisplay";
import { getRooms } from "../services/api";

const HomePage = () => {
  const [rooms, setRooms] = useState([]);
  const [boostedRooms, setBoostedRooms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch rooms function
  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRooms();
      setRooms(response.data || []);
      
      // Also fetch boost statuses
      const boostedResponse = await fetch('http://192.168.0.18:3001/rooms/boosted');
      if (boostedResponse.ok) {
        const boostedData = await boostedResponse.json();
        setBoostedRooms(boostedData);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      setError(err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    
    // Refresh data every minute to update boost timers
    const refreshInterval = setInterval(() => {
      fetchRooms();
    }, 60000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Handle boost activation
  const handleBoost = async (roomId, durationMinutes) => {
    try {
      const response = await fetch(`http://192.168.0.18:3001/rooms/${roomId}/boost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationMinutes }),
      });

      if (response.ok) {
        fetchRooms(); // Refresh data to show updated boost status
      } else {
        console.error('Failed to activate boost mode');
      }
    } catch (err) {
      console.error('Error activating boost:', err);
    }
  };

  // Handle boost cancellation
  const handleCancelBoost = async (roomId) => {
    try {
      const response = await fetch(`http://192.168.0.18:3001/rooms/${roomId}/cancel-boost`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchRooms(); // Refresh data to show updated boost status
      } else {
        console.error('Failed to cancel boost mode');
      }
    } catch (err) {
      console.error('Error cancelling boost:', err);
    }
  };

  return (
    <Box sx={{ width: '100%', px: 2, py: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom align="center">
        Room Overview
      </Typography>

      {loading && <LoadingSpinner />}
      {error && <ErrorDisplay error={error} />}

      {!loading && !error && rooms.length === 0 && (
        <Typography align="center" color="text.secondary" sx={{ mt: 4 }}>
          No rooms configured yet. Go to Settings to add rooms.
        </Typography>
      )}

      {!loading && !error && rooms.length > 0 && (
        <Box sx={{ width: '100%' }}>
          {rooms.map((room) => (
            <RoomCard 
              key={room.roomId} 
              room={room} 
              boostStatus={boostedRooms[room.roomId]} 
              onBoost={handleBoost}
              onCancelBoost={handleCancelBoost}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default HomePage;
