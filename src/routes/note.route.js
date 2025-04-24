
import { Router } from "express";
import { 
    getNotes,
    createNote,
    updateNote,
    deleteNote,
    getNoteByProjectId
} from "../controllers/note.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { noteValidator  } from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

// Get all notes 
router.get("/", getNotes);

// Create a new note
router.route("/projects/:projectId/notes").post(noteValidator(), validate, createNote)

// update a note
router.route("/projects/:projectId/notes/:noteId").put(noteValidator(), validate, updateNote)

// delete a note
router.route("/projects/:projectId/notes/:noteId").delete(deleteNote)

// get notes by project id
router.route("/projects/:projectId/notes").get(getNoteByProjectId)

export default router;