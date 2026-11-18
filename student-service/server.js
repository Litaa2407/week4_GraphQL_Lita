const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const express = require("express");
const { Pool } = require("pg");
const { publishStudentCreated } = require("./student-events");

const port = Number(process.env.PORT || 3001);
const teacherServiceUrl =
  process.env.TEACHER_SERVICE_URL || "http://127.0.0.1:3002";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function formatStudent(student) {
  return {
    ...student,
    tanggal:
      student.tanggal instanceof Date
        ? student.tanggal.toISOString().split("T")[0]
        : String(student.tanggal).slice(0, 10),
  };
}

async function validateTeacher(teacherId, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${teacherServiceUrl}/teachers/${teacherId}`, {
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

async function findConflictingStudent(database, nama, teacherId, exceptId) {
  const result = await database.query(
    `SELECT id FROM students
     WHERE LOWER(TRIM(nama)) = LOWER(TRIM($1))
       AND teacher_id = $2
       AND ($3::integer IS NULL OR id <> $3)
     LIMIT 1`,
    [nama, teacherId, exceptId ?? null]
  );
  return result.rows[0];
}

function createApp({
  database = pool,
  publishStudentCreated: publish = publishStudentCreated,
  fetchImpl = globalThis.fetch,
} = {}) {
  const app = express();

  app.use(express.json());

  app.get("/health", async (req, res) => {
    await database.query("SELECT 1");
    res.json({ status: "ok", service: "student-service" });
  });

  app.get("/students", async (req, res) => {
    const { teacher_id: teacherId } = req.query;
    const result = teacherId === undefined
      ? await database.query("SELECT * FROM students ORDER BY id")
      : await database.query(
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

    const result = await database.query("SELECT * FROM students WHERE id = $1", [id]);
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

    const validation = await validateTeacher(teacherId, fetchImpl);
    if (validation) {
      return res.status(validation.status).json({ error: validation.error });
    }
    console.log(`[student-service] teacher validated id=${teacherId}`);

    if (await findConflictingStudent(database, nama, teacherId)) {
      return res.status(409).json({
        error: "Student dengan nama dan teacher tersebut sudah terdaftar",
      });
    }

    const result = await database.query(
      `INSERT INTO students (nama, umur, tanggal, teacher_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
      [nama.trim(), umur, tanggal, teacherId]
    );
    console.log(
      `[student-service] student created id=${result.rows[0].id}, teacher_id=${teacherId}`
    );

    try {
      await publish(result.rows[0]);
    } catch (error) {
      console.error(
        `Student ${result.rows[0].id} tersimpan, tetapi event notifikasi gagal dipublikasikan:`,
        error
      );
      return res.status(503).json({
        error: "Student tersimpan, tetapi notifikasi belum masuk antrean",
        student_id: result.rows[0].id,
      });
    }

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

    const validation = await validateTeacher(teacherId, fetchImpl);
    if (validation) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const existingStudent = await database.query(
      "SELECT id FROM students WHERE id = $1",
      [id]
    );
    if (!existingStudent.rows[0]) {
      return res.status(404).json({ error: "Student tidak ditemukan" });
    }

    if (await findConflictingStudent(database, nama, teacherId, id)) {
      return res.status(409).json({
        error: "Student dengan nama dan teacher tersebut sudah terdaftar",
      });
    }

    const result = await database.query(
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

    const result = await database.query(
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

  return app;
}

if (require.main === module) {
  createApp().listen(port, () => {
    console.log(`Student service berjalan di port ${port}`);
  });
}

module.exports = { createApp };
