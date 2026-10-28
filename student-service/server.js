const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3001);
const teacherServiceUrl =
  process.env.TEACHER_SERVICE_URL || "http://localhost:3002";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());

function formatStudent(student) {
  return {
    ...student,
    tanggal:
      student.tanggal instanceof Date
        ? student.tanggal.toISOString().split("T")[0]
        : String(student.tanggal).slice(0, 10),
  };
}

async function validateTeacher(teacherId) {
  let response;
  try {
    response = await fetch(`${teacherServiceUrl}/teachers/${teacherId}`, {
      signal: AbortSignal.timeout(2000),
    });
  } catch (error) {
    const reason =
      error.name === "TimeoutError"
        ? "Teacher service timeout setelah 2 detik"
        : "Teacher service tidak dapat dihubungi";
    return { status: 503, error: reason };
  }

  if (response.status === 404) {
    return { status: 422, error: "Teacher tidak ditemukan" };
  }
  if (!response.ok) {
    return { status: 503, error: "Teacher service gagal memvalidasi teacher" };
  }
  return null;
}

app.get("/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", service: "student-service" });
});

app.get("/students", async (req, res) => {
  const { teacher_id: teacherId } = req.query;
  const result = teacherId === undefined
    ? await pool.query("SELECT * FROM students ORDER BY id")
    : await pool.query(
      "SELECT * FROM students WHERE teacher_id = $1 ORDER BY id",
      [teacherId]
    );
  res.json(result.rows.map(formatStudent));
});

app.get("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Student id tidak valid" });
  }

  const result = await pool.query("SELECT * FROM students WHERE id = $1", [id]);
  if (!result.rows[0]) {
    return res.status(404).json({ error: "Student tidak ditemukan" });
  }
  return res.json(formatStudent(result.rows[0]));
});

app.post("/students", async (req, res) => {
  const { nama, umur, tanggal, teacher_id: teacherId } = req.body;
  if (
    typeof nama !== "string" ||
    !nama.trim() ||
    !Number.isInteger(umur) ||
    typeof tanggal !== "string" ||
    !Number.isInteger(teacherId) ||
    teacherId < 1
  ) {
    return res.status(400).json({ error: "Data student tidak valid" });
  }

  const validation = await validateTeacher(teacherId);
  if (validation) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const result = await pool.query(
    `INSERT INTO students (nama, umur, tanggal, teacher_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nama.trim(), umur, tanggal, teacherId]
  );
  return res.status(201).json(formatStudent(result.rows[0]));
});

app.put("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { nama, umur, tanggal, teacher_id: teacherId } = req.body;
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    typeof nama !== "string" ||
    !nama.trim() ||
    !Number.isInteger(umur) ||
    typeof tanggal !== "string" ||
    !Number.isInteger(teacherId) ||
    teacherId < 1
  ) {
    return res.status(400).json({ error: "Data student tidak valid" });
  }

  const validation = await validateTeacher(teacherId);
  if (validation) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const result = await pool.query(
    `UPDATE students
     SET nama = $1, umur = $2, tanggal = $3, teacher_id = $4
     WHERE id = $5
     RETURNING *`,
    [nama.trim(), umur, tanggal, teacherId, id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ error: "Student tidak ditemukan" });
  }
  return res.json(formatStudent(result.rows[0]));
});

app.delete("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Student id tidak valid" });
  }

  const result = await pool.query(
    "DELETE FROM students WHERE id = $1 RETURNING id",
    [id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ error: "Student tidak ditemukan" });
  }
  return res.json(formatStudent(result.rows[0]));
});

app.use((error, req, res, next) => {
  console.error("Student service error:", error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: "Gagal memproses data student" });
});

app.listen(port, () => {
  console.log(`Student service berjalan di port ${port}`);
});
