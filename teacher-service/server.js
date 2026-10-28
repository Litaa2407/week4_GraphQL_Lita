const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3002);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.get("/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", service: "teacher-service" });
});

app.get("/teachers", async (req, res) => {
  const result = await pool.query("SELECT * FROM teachers ORDER BY id");
  res.json(result.rows);
});

app.get("/teachers/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Teacher id tidak valid" });
  }

  const delayMs = Number(process.env.TEACHER_SERVICE_DELAY_MS || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const result = await pool.query("SELECT * FROM teachers WHERE id = $1", [id]);
  if (!result.rows[0]) {
    return res.status(404).json({ error: "Teacher tidak ditemukan" });
  }

  return res.json(result.rows[0]);
});

app.use((error, req, res, next) => {
  console.error("Teacher service error:", error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: "Gagal memproses data teacher" });
});

app.listen(port, () => {
  console.log(`Teacher service berjalan di port ${port}`);
});
