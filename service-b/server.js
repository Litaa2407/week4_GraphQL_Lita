const express = require("express");

const app = express();
const port = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.json({ service: "service-b", message: "Service B aktif" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "service-b" });
});

app.listen(port, () => console.log(`Service B berjalan di port ${port}`));
