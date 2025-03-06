const express = require("express");
const app = express();

const PORT = process.env.PORT || 3001;

// Health Check Route
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Sample API Route
app.get("/", (req, res) => {
    res.send(`Response from backend server on port ${PORT}`);
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
