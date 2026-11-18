const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const specification = require("./openapi.json");
const studentServiceSource = fs.readFileSync(
  path.join(__dirname, "..", "student-service", "server.js"),
  "utf8"
);
const paths = specification.paths;

const operationsByTag = new Map();
for (const pathItem of Object.values(paths)) {
  for (const operation of Object.values(pathItem)) {
    if (!operation || typeof operation !== "object" || !operation.tags) continue;
    for (const tag of operation.tags) {
      operationsByTag.set(tag, (operationsByTag.get(tag) || 0) + 1);
    }
  }
}

assert.ok(operationsByTag.get("Student Service") >= 3);
assert.ok(operationsByTag.get("Teacher Service") >= 3);
assert.ok(paths["/student-service/students"].post.responses["409"]);
assert.ok(paths["/student-service/students/{id}"].put.responses["409"]);
assert.match(studentServiceSource, /res\.status\(409\)/);
assert.match(
  studentServiceSource,
  /Student dengan nama dan teacher tersebut sudah terdaftar/
);

console.log("OpenAPI contract OK: both service groups and 409 behavior are documented.");
