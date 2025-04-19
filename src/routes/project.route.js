
import { Router } from "express";
import { createProject, deleteProject, getProject, getProjects, updateProject } from "../controllers/project.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import { validate } from "../middlewares/validator.middleware.js";

const router = Router()



export default router;