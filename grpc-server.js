require("dotenv").config();

const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { Pool } = require("pg");

const PROTO_PATH = path.join(__dirname, "student.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const studentProto = grpc.loadPackageDefinition(packageDefinition).student;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

async function getStudent(call, callback) {
  try {
    const result = await pool.query(
      "SELECT id, nama, umur, tanggal, teacher_id FROM students WHERE id = $1",
      [call.request.id]
    );

    const student = result.rows[0];

    if (!student) {
      callback({
        code: grpc.status.NOT_FOUND,
        details: "Student tidak ditemukan",
      });
      return;
    }

    callback(null, {
      ...student,
      tanggal: student.tanggal.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error(error);
    callback({
      code: grpc.status.INTERNAL,
      details: "Gagal mengambil data student",
    });
  }
}

const server = new grpc.Server();
server.addService(studentProto.StudentService.service, { getStudent });

const port = process.env.PORT || 50051;
server.bindAsync(
  `0.0.0.0:${port}`,
  grpc.ServerCredentials.createInsecure(),
  (error, boundPort) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    console.log(`gRPC server berjalan di port ${boundPort}`);
    server.start();
  }
);