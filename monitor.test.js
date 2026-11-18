const assert = require("node:assert/strict");
const test = require("node:test");
const { TARGETS, checkTarget } = require("./monitor");

test("monitor reports ALERT after a target goes down and RECOVERED when it returns", async () => {
  const target = TARGETS.find(({ name }) => name === "teacher-service");
  assert.ok(target);
  const messages = [];
  const originalLog = console.log;
  console.log = (message) => messages.push(message);

  try {
    const up = await checkTarget(target, undefined, async () => ({
      ok: true,
      status: 200,
      async json() {
        return { status: "ok" };
      },
    }));
    const down = await checkTarget(target, up, async () => {
      throw new Error("connection refused");
    });
    const recovered = await checkTarget(target, down, async () => ({
      ok: true,
      status: 200,
      async json() {
        return { status: "ok" };
      },
    }));

    assert.equal(up, true);
    assert.equal(down, false);
    assert.equal(recovered, true);
    assert.match(messages[1], /\[ALERT\].*teacher-service/);
    assert.match(messages[2], /\[RECOVERED\].*teacher-service/);
  } finally {
    console.log = originalLog;
  }
});
