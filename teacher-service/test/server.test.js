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

test("GET /teachers returns teacher records", async (t) => {
  const teachers = [{ id: 4, nama: "Bu Ratna" }];
  const database = {
    async query(sql) {
      assert.match(sql, /SELECT \* FROM teachers ORDER BY id/);
      return { rows: teachers };
    },
  };
  const baseUrl = await serve(createApp({ database }), t);

  const response = await fetch(`${baseUrl}/teachers`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), teachers);
});

test("GET /teachers/:id returns 404 when the teacher does not exist", async (t) => {
  const database = {
    async query(sql, values) {
      assert.match(sql, /SELECT \* FROM teachers WHERE id = \$1/);
      assert.deepEqual(values, [999]);
      return { rows: [] };
    },
  };
  const baseUrl = await serve(createApp({ database }), t);

  const response = await fetch(`${baseUrl}/teachers/999`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "Teacher tidak ditemukan",
  });
});

test("GET /health probes the database before reporting the service healthy", async (t) => {
  const queries = [];
  const database = {
    async query(sql) {
      queries.push(sql);
      return { rows: [{ "?column?": 1 }] };
    },
  };
  const baseUrl = await serve(createApp({ database }), t);

  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "teacher-service",
  });
  assert.deepEqual(queries, ["SELECT 1"]);
});
