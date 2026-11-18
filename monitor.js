const TARGETS = [
  {
    name: "student-service",
    url: process.env.STUDENT_HEALTH_URL || "http://localhost:3001/health",
  },
  {
    name: "teacher-service",
    url: process.env.TEACHER_HEALTH_URL || "http://localhost:3002/health",
  },
];

const intervalMs = Number(process.env.MONITOR_INTERVAL_MS || 5000);
const timeoutMs = Number(process.env.MONITOR_TIMEOUT_MS || 2000);

function logTransition(target, isHealthy, previousState, detail) {
  const time = new Date().toISOString();
  if (!isHealthy) {
    if (previousState !== false) {
      console.log(`[${time}] [ALERT] ${target.name} tidak sehat (${detail})`);
    }
    return;
  }

  if (previousState === false) {
    console.log(`[${time}] [RECOVERED] ${target.name} kembali sehat`);
  } else if (previousState === undefined) {
    console.log(`[${time}] [UP] ${target.name} sehat`);
  }
}

async function checkTarget(target, previousState, fetchImpl = globalThis.fetch) {
  let isHealthy = false;
  let detail = "health check gagal";
  try {
    const response = await fetchImpl(target.url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json();
    isHealthy = response.ok && body.status === "ok";
    detail = `HTTP ${response.status}`;
  } catch (error) {
    detail = error.name === "TimeoutError" ? "timeout" : error.message;
  }

  logTransition(target, isHealthy, previousState, detail);
  return isHealthy;
}

async function runMonitor(targets = TARGETS) {
  if (!Number.isFinite(intervalMs) || intervalMs < 1) {
    throw new Error("MONITOR_INTERVAL_MS harus berupa angka positif");
  }
  const states = new Map();
  console.log(`Memantau ${targets.map((target) => target.name).join(", ")}`);

  while (true) {
    await Promise.all(targets.map(async (target) => {
      const previousState = states.get(target.name);
      states.set(target.name, await checkTarget(target, previousState));
    }));
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (require.main === module) {
  runMonitor().catch((error) => {
    console.error(`Monitor gagal: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { TARGETS, checkTarget, logTransition, runMonitor };
