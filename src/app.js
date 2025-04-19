
import express from "express";
import healthCheckRouter from "./routes/healthcheck.route.js";
import authRouter from "./routes/auth.route.js";

const app = express();

// router imports

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter)



export default app;