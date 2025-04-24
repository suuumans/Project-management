
import { Router } from "express";
import { 
    getProjectTask,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getMyTasks
} from "../controllers/task.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { createTaskValidator } from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

// Get all notes 
router.get("/", getMyTasks);

// get project tasks
router.route("/projects/:projectId/tasks").get(getProjectTask)

// get task by id
router.route("/tasks/:taskId").get(getTaskById)

// create task
router.route("/projects/:projectId/tasks").post(createTaskValidator(), validate, createTask)

// update task
router.route("/tasks/:taskId").put(createTaskValidator(), validate, updateTask)

// delete task
router.route("/tasks/:taskId").delete(deleteTask)

export default router;