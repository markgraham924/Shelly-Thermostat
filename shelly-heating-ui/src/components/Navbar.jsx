// src/components/NavBar.js
import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import ScheduleIcon from '@mui/icons-material/Schedule'; // Import Schedule icon

const NavBar = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Heating Control
        </Typography>
        <Box>
          <Button color="inherit" component={RouterLink} to="/" startIcon={<HomeIcon />}>
            Home
          </Button>
          {/* Add Schedule Button */}
          <Button color="inherit" component={RouterLink} to="/schedule" startIcon={<ScheduleIcon />}>
            Schedules
          </Button>
          <Button color="inherit" component={RouterLink} to="/settings" startIcon={<SettingsIcon />}>
            Settings
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;
