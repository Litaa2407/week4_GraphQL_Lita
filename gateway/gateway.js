require("dotenv").config();

const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const swaggerUi = require("swagger-ui-express");
const openApiDocument = require("./openapi.json");

const app = express();
const port = process.env.PORT || 8080;
const serviceAUrl = process.env.SERVICE_A_URL || "http://localhost:3000";
const studentServiceUrl =
  process.env.STUDENT_SERVICE_URL || "http://localhost:3001";
const teacherServiceUrl =
  process.env.TEACHER_SERVICE_URL ||
  process.env.SERVICE_B_URL ||
  "http://localhost:3002";

app.set("trust proxy", 1);

app.get("/openapi.json", (req, res) => res.json(openApiDocument));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use(
  rateLimit({
    windowMs: 10 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const requireApiKey = (req, res, next) => {
  if (process.env.API_KEY && req.get("X-API-Key") !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

app.use("/teacher-service", requireApiKey);
app.use("/service-b", requireApiKey);

const createServiceProxy = (prefix, target) =>
  createProxyMiddleware({
    pathFilter: (path) => path === prefix || path.startsWith(`${prefix}/`),
    target,
    changeOrigin: true,
    pathRewrite: (path) => path.replace(prefix, "") || "/",
    on: {
      error(error, req, res) {
        console.error(`Proxy error for ${prefix}:`, error.message);
        if (!res.headersSent) {
          res.status(503).json({
            error: `Service untuk ${prefix} tidak tersedia`,
          });
        }
      },
    },
  });

app.use(createServiceProxy("/service-a", serviceAUrl));
app.use(createServiceProxy("/student-service", studentServiceUrl));
app.use(createServiceProxy("/teacher-service", teacherServiceUrl));
app.use(createServiceProxy("/service-b", teacherServiceUrl));

app.use((req, res) => res.status(404).json({ error: "Route tidak ditemukan" }));

app.listen(port, () => console.log(`Gateway berjalan di port ${port}`));
