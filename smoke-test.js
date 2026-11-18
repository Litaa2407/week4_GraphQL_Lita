const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

const root = __dirname;
const rootEnvPath = path.join(root, ".env");
const rootEnv = fs.existsSync(rootEnvPath)
  ? dotenv.parse(fs.readFileSync(rootEnvPath))
  : {};
const studentServicePath = path.join(root, "student-service", "server.js");
const teacherServicePath = path.join(root, "teacher-service", "server.js");
const gatewayPath = path.join(root, "gateway", "gateway.js");
const studentServicePort = Number(process.env.SMOKE_STUDENT_PORT || 3001);
const teacherServicePort = Number(process.env.SMOKE_TEACHER_PORT || 3002);
const gatewayPort = Number(process.env.SMOKE_GATEWAY_PORT || 8080);
const serviceAUrl = process.env.SERVICE_A_URL || "http://localhost:3000";
const studentServiceUrl = `http://localhost:${studentServicePort}`;
const teacherServiceUrl = `http://localhost:${teacherServicePort}`;
const gatewayUrl = `http://localhost:${gatewayPort}`;
const children = new Set();
let createdStudentId;

function startProcess(scriptPath, env) {
  const childEnv = { ...process.env, ...env };
  delete childEnv.JWT_SECRET;
  delete childEnv.GITHUB_CLIENT_SECRET;
  if (scriptPath === gatewayPath) delete childEnv.DATABASE_URL;

  const child = spawn(process.execPath, [scriptPath], {
    cwd: path.dirname(scriptPath),
    env: childEnv,
    stdio: "inherit",
  });

  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function readJson(response) {
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function createSmokeToken() {
  const secret = process.env.JWT_SECRET || rootEnv.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET harus tersedia dan minimal 32 karakter");
  }
  return jwt.sign(
    { login: "smoke-test", name: "Smoke Test" },
    secret,
    { algorithm: "HS256", subject: "smoke-test", expiresIn: "5m" }
  );
}

async function graphqlQuery(query) {
  const response = await request(`${gatewayUrl}/service-a/api/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createSmokeToken()}`,
    },
    body: JSON.stringify({ query }),
  });
  const body = await readJson(response);
  assert(
    response.status === 200 && !body.errors,
    `GraphQL query gagal: ${body.errors?.[0]?.message || response.status}`
  );
  return body.data;
}

async function waitForStatus(url, expectedStatus, child, label, options) {
  const deadline = Date.now() + 15000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `${label} berhenti dengan exit code ${child.exitCode} ` +
          `dan signal ${child.signalCode}`
      );
    }

    try {
      const response = await request(url, options);
      if (response.status === expectedStatus) return response;
      lastError = new Error(`status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `${label} tidak memberi status ${expectedStatus} dalam 15 detik. ` +
      `Terakhir: ${lastError?.message || "belum ada respons"}`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function logPass(message) {
  console.log(`[PASS] ${message}`);
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Proses ${child.pid} tidak berhenti setelah SIGTERM`));
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

async function cleanup() {
  let cleanupError;
  try {
    if (createdStudentId !== undefined) {
      const response = await request(
        `${gatewayUrl}/student-service/students/${createdStudentId}`,
        { method: "DELETE" }
      );
      if (response.status !== 200 && response.status !== 404) {
        throw new Error(
          `Gagal menghapus data student smoke test: ${response.status}`
        );
      }
      createdStudentId = undefined;
    }
  } catch (error) {
    cleanupError = error;
  }

  await Promise.all([...children].map((child) => stopProcess(child)));
  if (cleanupError) throw cleanupError;
}

async function run() {
  let studentService;
  let teacherService;

  try {
    studentService = startProcess(studentServicePath, {
      PORT: String(studentServicePort),
      TEACHER_SERVICE_URL: teacherServiceUrl,
    });
    teacherService = startProcess(teacherServicePath, {
      PORT: String(teacherServicePort),
      TEACHER_SERVICE_DELAY_MS: "0",
    });

    await waitForStatus(
      `${studentServiceUrl}/health`,
      200,
      studentService,
      "Student service"
    );
    await waitForStatus(
      `${teacherServiceUrl}/health`,
      200,
      teacherService,
      "Teacher service"
    );

    const gateway = startProcess(gatewayPath, {
      PORT: String(gatewayPort),
      SERVICE_A_URL: serviceAUrl,
      STUDENT_SERVICE_URL: studentServiceUrl,
      TEACHER_SERVICE_URL: teacherServiceUrl,
      SERVICE_B_URL: teacherServiceUrl,
      API_KEY: "",
    });
    await waitForStatus(
      `${gatewayUrl}/student-service/health`,
      200,
      gateway,
      "Gateway"
    );

    if (studentServicePort === 3001 && teacherServicePort === 3002) {
      const graphData = await graphqlQuery(
        "query { students { id } teachers { id } }"
      );
      assert(
        Array.isArray(graphData.students) && Array.isArray(graphData.teachers),
        "GraphQL harus meneruskan query student dan teacher ke service"
      );
      logPass("GraphQL meneruskan query student dan teacher -> 200");
    } else {
      console.log(
        "[SKIP] GraphQL delegation check memerlukan service pada port 3001 dan 3002"
      );
    }

    const teachersResponse = await request(
      `${gatewayUrl}/teacher-service/teachers`
    );
    assert(
      teachersResponse.status === 200,
      `Teacher service harus menjawab 200, mendapat ${teachersResponse.status}`
    );
    const teachers = await readJson(teachersResponse);
    assert(
      Array.isArray(teachers) && teachers.length > 0,
      "Database harus memiliki minimal satu teacher untuk menguji POST student"
    );
    const teacherId = Number(teachers[0].id);

    const studentsResponse = await request(
      `${gatewayUrl}/student-service/students`
    );
    assert(
      studentsResponse.status === 200,
      `Student service harus menjawab 200, mendapat ${studentsResponse.status}`
    );
    logPass(
      `GET /student-service/students -> ${studentsResponse.status}`
    );

    await stopProcess(teacherService);
    const payload = {
      nama: `Smoke Test ${Date.now()}`,
      umur: 20,
      tanggal: "2000-01-01",
      teacher_id: teacherId,
    };
    const unavailableResponse = await waitForStatus(
      `${gatewayUrl}/student-service/students`,
      503,
      gateway,
      "Student service saat teacher service berhenti",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    const unavailableBody = await readJson(unavailableResponse);
    assert(
      unavailableBody.error?.includes("Teacher service"),
      "Respons 503 harus menjelaskan kegagalan teacher service"
    );
    logPass(
      `POST /student-service/students saat teacher-service mati -> 503 (${unavailableBody.error})`
    );

    const independentResponse = await request(
      `${gatewayUrl}/student-service/students`
    );
    assert(
      independentResponse.status === 200,
      `GET student harus tetap 200, mendapat ${independentResponse.status}`
    );
    logPass(
      `GET /student-service/students saat teacher-service mati -> ${independentResponse.status}`
    );
    if (studentServicePort === 3001 && teacherServicePort === 3002) {
      const graphData = await graphqlQuery("query { students { id } }");
      assert(
        Array.isArray(graphData.students),
        "GraphQL student query harus tetap berfungsi saat teacher-service mati"
      );
      logPass("GraphQL student query saat teacher-service mati -> 200");
    }

    teacherService = startProcess(teacherServicePath, {
      PORT: String(teacherServicePort),
      TEACHER_SERVICE_DELAY_MS: "0",
    });
    await waitForStatus(
      `${teacherServiceUrl}/health`,
      200,
      teacherService,
      "Teacher service setelah dinyalakan kembali"
    );

    const recoveredResponse = await request(
      `${gatewayUrl}/student-service/students`,
      { method: "POST", body: JSON.stringify(payload) }
    );
    const recoveredBody = await readJson(recoveredResponse);
    createdStudentId = recoveredBody?.id;
    assert(
      recoveredResponse.status === 201,
      `POST setelah teacher-service pulih harus 201, mendapat ${recoveredResponse.status}: ${recoveredBody?.error || ""}`
    );
    logPass(
      `POST /student-service/students setelah teacher-service pulih -> ${recoveredResponse.status}`
    );
  } finally {
    await cleanup();
  }
}

run().catch((error) => {
  console.error(`[FAIL] Smoke test gagal: ${error.message}`);
  process.exitCode = 1;
});
