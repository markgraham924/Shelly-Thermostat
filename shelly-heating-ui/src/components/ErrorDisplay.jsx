// src/components/ErrorDisplay.js
import React from "react";
import { Alert, AlertTitle } from "@mui/material";

const ErrorDisplay = ({ error }) => {
  const message = error?.response?.data?.message || error?.message || "An unknown error occurred.";
  return (
    <Alert severity="error" sx={{ m: 2 }}>
      <AlertTitle>Error</AlertTitle>
      {message}
    </Alert>
  );
};

export default ErrorDisplay;