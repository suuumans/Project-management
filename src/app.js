
import express from "express";
import healthCheckRouter from "./routes/healthcheck.route.js";
import authRouter from "./routes/auth.route.js";
import projectRouter from "./routes/project.route.js";
import taskRouter from "./routes/task.route.js";
import noteRouter from "./routes/note.route.js";


const app = express();

// router imports

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/project", projectRouter)
app.use("/api/v1/task", taskRouter)
app.use("/api/v1/notes", noteRouter)



export default app;