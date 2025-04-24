
import { Router } from "express";
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addMemberToProject,
  removeMemberFromProject,
  getProjectMembers,
  updateProjectMemberRole,
  getProjectTasks
} from "../controllers/project.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { projectValidator } from "../validators/index.js";

const router = Router();

// All routes below require authentication
router.use(verifyJWT);

// Get all projects (created by user or member of)
router.route("/").get(getProjects);

// Create a new project
router.route("/").post(projectValidator(), validate, createProject);

// Get a single project by ID
router.route("/:projectId").get(getProjectById);

// Update a project
router.route("/:projectId").put(projectValidator(), validate, updateProject);

// Delete a project
router.route("/:projectId").delete(deleteProject);

// Get all members of a project
router.route("/:projectId/members").get(getProjectMembers);

// Add a member to a project
router.route("/:projectId/members").post(addMemberToProject);

// Remove a member from a project
router.route("/:projectId/members/:memberId").delete(removeMemberFromProject);

// Update a project member's role
router.route("/:projectId/members/:memberId").patch(updateProjectMemberRole);

// Get all tasks for a project
router.route("/:projectId/tasks").get(getProjectTasks);

export default router;