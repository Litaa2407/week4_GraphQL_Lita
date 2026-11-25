const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

const root = __dirname;
const gatewayUrl = process.env.COMPOSE_GATEWAY_URL || "http://localhost:8080";
const composeTestEnabled = process.env.COMPOSE_TEST === "1";

function compose(args) {
  const result = spawnSync("docker", ["compose", ...args], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `docker compose ${args.join(" ")} gagal: ` +
        `${result.error?.message || result.stderr || result.stdout}`
    );
  }
}

async function request(pathname, options) {
  return fetch(`${gatewayUrl}${pathname}`, {
    ...options,
    signal: AbortSignal.timeout(3000),
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

async function waitForTeacherService() {
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await request("/teacher-service/teachers");
      if (response.status === 200) return;
      lastError = new Error(`status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `teacher-service tidak pulih dalam 30 detik: ${lastError?.message}`
  );
}

test(
  "Compose mengembalikan 503 saat teacher-service mati dan 201 setelah pulih",
  { skip: !composeTestEnabled, timeout: 90000 },
  async (t) => {
    const teachersResponse = await request("/teacher-service/teachers");
    assert.equal(teachersResponse.status, 200);
    const teachers = await teachersResponse.json();
    assert.ok(teachers.length > 0, "Compose harus menyediakan teacher demo");

    const payload = {
      nama: `Compose smoke ${randomUUID()}`,
      umur: 20,
      tanggal: "2000-01-01",
      teacher_id: Number(teachers[0].id),
    };
    let teacherStopped = false;
    let createdStudentId;

    try {
      compose(["stop", "teacher-service"]);
      teacherStopped = true;

      const unavailableResponse = await request(
        "/student-service/students",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      const unavailableBody = await unavailableResponse.json();
      createdStudentId = unavailableBody.student_id;
      t.diagnostic(
        `POST saat teacher-service dihentikan -> ${unavailableResponse.status}`
      );
      assert.equal(unavailableResponse.status, 503);

      compose(["start", "teacher-service"]);
      await waitForTeacherService();
      teacherStopped = false;

      const recoveredResponse = await request(
        "/student-service/students",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      const recoveredBody = await recoveredResponse.json();
      createdStudentId = recoveredBody.id || recoveredBody.student_id;
      t.diagnostic(
        `POST setelah teacher-service dinyalakan kembali -> ${recoveredResponse.status}`
      );
      assert.equal(recoveredResponse.status, 201);
    } finally {
      if (teacherStopped) {
        compose(["start", "teacher-service"]);
        await waitForTeacherService();
      }

      if (createdStudentId !== undefined) {
        const deleteResponse = await request(
          `/student-service/students/${encodeURIComponent(createdStudentId)}`,
          { method: "DELETE" }
        );
        assert.ok(
          [200, 404].includes(deleteResponse.status),
          `Gagal membersihkan student smoke test: ${deleteResponse.status}`
        );
      }
    }
  }
);
