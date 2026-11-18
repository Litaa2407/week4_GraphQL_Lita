const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const { createApp } = require("../server");

async function serve(app, t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("GET /students/:id returns a student from the database", async (t) => {
  const student = {
    id: 8,
    nama: "Nadia",
    umur: 20,
    tanggal: new Date("2005-01-02T00:00:00.000Z"),
    teacher_id: 4,
  };
  const database = {
    async query(sql, values) {
      assert.match(sql, /SELECT \* FROM students WHERE id = \$1/);
      assert.deepEqual(values, [8]);
      return { rows: [student] };
    },
  };
  const baseUrl = await serve(createApp({ database }), t);

  const response = await fetch(`${baseUrl}/students/8`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ...student,
    tanggal: "2005-01-02",
  });
});

test("GET /students/:id rejects an invalid id without querying the database", async (t) => {
  const database = {
    async query() {
      assert.fail("Invalid IDs must not query the database");
    },
  };
  const baseUrl = await serve(createApp({ database }), t);

  const response = await fetch(`${baseUrl}/students/not-a-number`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Student id tidak valid",
  });
});

test("POST /students publishes an event after inserting the student", async (t) => {
  const student = {
    id: 23,
    nama: "Bima",
    umur: 19,
    tanggal: "2007-03-04",
    teacher_id: 4,
  };
  const queries = [];
  const database = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("SELECT id FROM students")) return { rows: [] };
      if (sql.includes("INSERT INTO students")) return { rows: [student] };
      assert.fail(`Unexpected database query: ${sql}`);
    },
  };
  const publishedEvents = [];
  const baseUrl = await serve(createApp({
    database,
    fetchImpl: async (url) => {
      assert.equal(url, "http://127.0.0.1:3002/teachers/4");
      return { ok: true, status: 200 };
    },
    publishStudentCreated: async (createdStudent) => {
      publishedEvents.push(createdStudent);
    },
  }), t);

  const response = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nama: " Bima ",
      umur: 19,
      tanggal: "2007-03-04",
      teacher_id: 4,
    }),
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).id, student.id);
  assert.equal(queries.length, 2);
  assert.deepEqual(publishedEvents, [student]);
});
