
import { ProjectNote } from "../models/note.model";
import { Project } from "../models/project.model";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { isProjectAdmin, isProjectMember } from "../utils/helper";



/**
 * @description Create a new note
 * @param { string } projectId - id of the project
 * @body { string } content of the note
 * @route POST /api/v1/projects/:projectId/notes
 * @access Private (Project members only) 
 */
const createNote = asyncHandler(async (req, res) => {
    // extract data from request
    const { content} = req.body
    const { projectId } = req.params
    const userId = req.user._id

    // check if project id is present
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, "Invalid project ID");
    }

    // check if content is present
    if (!content || typeof content !== "string" || !content.trim()) {
        throw new ApiError(400, "Content is required");
    }

    // check if project exists
    const project = await Project.findById(projectId).select("_id").lean()
    if(!project) {
        throw new ApiError(404, "Project not found");
    }

    // check if the the member of the project and is allowed to create task
    const isMember = await isProjectMember(projectId, userId)
    if (!isMember) {
        throw new ApiError(403, "You are not a member of this project. You are not authorized to create note in this project");
    }

    // create note using a mongoose session to ensure data consistency
    const session = await mongoose.session()

    try {
        // start a transaction
        session.startTransaction()

        // create the note
        const note = await ProjectNote.create([{
            project: projectId,
            createdBy: userId,
            content: content.trim()
        }], { session })

        // populate the created note for response
        const createdNote = await ProjectNote.findById(note[0]._id)
            .populate({ path: "createdBy", select: "fullName email" })
            .populate({ path: "project", select: "name" })
            .session(session)
            .lean()

        // commit the transaction
        await session.commitTransaction()

        // return response
        return res.status(201).json(
            new ApiResponse(201, {note: createdNote}, "Note created successfully")
        )

    } catch (error) {
        // abort the transaction
        await session.abortTransaction()

        console.error('Error creating project note:', error);
        throw new ApiError(500, "Internal server error while creating note");
    }
    
});

/**
 * @description Get all notes
 * @query { object } various filter parameters (projectId, page, limit, sortBy, order, search)
 * @route GET /api/v1/notes
 * @access Private (user can only see notes from the projects they are a member of)
 */
const getNotes = asyncHandler(async (req, res) => {
    const { projectId, page = 1, limit = 10, sort = "createdAt", order = "desc" } = req.query
    const userId = req.user._id

    try {
        // create the filter object
        const filter = {}

        // check if project id is present
        if (projectId) {
            if (!mongoose.Types.ObjectId.isValid(projectId)) {
                throw new ApiError(400, "Invalid project ID");
            }
        

            // check if the project exists
            const project = await Project.findById(projectId).select("_id").lean()
            if(!project) {
                throw new ApiError(404, "Project not found");
            }

            // check if the user is member of the project
            const isMember = await isProjectMember(projectId, userId)
            if (!isMember) {
                throw new ApiError(403, "You are not a member of this project. You are not authorized to view notes in this project");
            }

            // filter object dynamically
            filter.project = projectId

        } else {
            // if the project id is not present, check if the user is a member of any project
            const memberProjects = await Project.find({
                $or: [
                    { createdBy: userId },
                    { _id: { $in: await ProjectMember.distinct("project", { users: userId }) } } // get all project ids where the user is a member
                ]
            }).select("_id").lean()

            // check if the user is a member of any project
            if (memberProjects.length === 0) {
                throw new ApiError(403, "You are not a member of any project. You are not authorized to view notes");
            }

            // filter by projects the user is a member of
            filter.project = { $in: memberProjects.map(project => project._id) }
        }
        
        // prepare pagination
        const pageNumber = parseInt(page, 10) || 1
        const limitNumber = parseInt(limit, 10) || 10
        const skip = (pageNumber - 1) * limitNumber

        // create sort options
        const sortOptions = {}
        sortOptions[sort] = order === "asc" ? 1 : -1 // 1 for asc, -1 for desc

        // total count for pagination
        const totalNotes = await ProjectNote.countDocuments(filter)

        // get all notes
        const notes = await ProjectNote.find(filter)
            .populate({ path: "createdBy", select: "fullName email" })
            .populate({ path: "project", select: "name" })
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNumber)
            .lean()

        // return response
        return res.status(200).json(
            new ApiResponse(200, {
                notes,
                pagination: {
                    totalNotes,
                    page: pageNumber,
                    limit: limitNumber,
                    pages: Math.ceil(totalNotes / limitNumber)
                }
            }, "Notes fetched successfully")
        )

    } catch (error) {
        console.error("Error fetching notes: ", error);
        throw new ApiError(500, "Internal server error while fetching notes");
    }
});

/**
 * @description Update a note
 * @param { string } noteId - id of the note
 * @body { string } content of the note
 * @route PUT /api/v1/notes/:noteId
 * @access Private (Project members only)
 */
const updateNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params
    const { content } = req.body
    const userId = req.user._id

    // check if note id is present
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
        throw new ApiError(400, "Invalid note ID");
    }

    // check if content is present
    if (!content || typeof content !== "string" || !content.trim()) {
        throw new ApiError(400, "Content is required");
    }

    try {
        // check if note exists
        const note = await ProjectNote.findById(noteId).populate("project", "_id").lean()
        if(!note) {
            throw new ApiError(404, "Note not found");
        }

        // check if the user is creator of the note or a project admin
        const isCreator = note.createdBy.equals(userId)
        const isAdmin = await isProjectAdmin(note.project._id, userId)
        if (!isCreator && !isAdmin) {
            throw new ApiError(403, "You are not authorized to update this note");
        }
        
        // update the note using a mongoose session to ensure data consistency
        const session = await mongoose.session()

        try {
            // start a transaction
            session.startTransaction()

            // update the note
            const updatedNote = await ProjectNote.findByIdAndUpdate(
                noteId,
                { $set: { content: content.trim() } },
                { new: true, runValidators: true }
            )
                .populate({ path: "createdBy", select: "fullName email" })
                .populate({ path: "project", select: "name" })
                .session(session)
                .lean()

            // commit the transaction
            await session.commitTransaction()

            // return response
            return res.status(200).json(
                new ApiResponse(200, updatedNote, "Note updated successfully")
            )
        } catch (error) {
            // abort the transaction
            await session.abortTransaction()

            throw new ApiError(500, "Failed to update note due to a database error");
        } finally {
            // end the session
            await session.endSession()
        }
    } catch (error) {
        console.error("Error updating note: ", error);
        throw new ApiError(500, "Internal server error while updating note");
    }
});

/**
 * @description Delete a note
 * @param { string } noteId - id of the note
 * @route DELETE /api/v1/notes/:noteId
 * @access Private (Project members only)
 */
const deleteNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params
    const userId = req.user._id

    // check if note id is present
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
        throw new ApiError(400, "Invalid note ID");
    }

    try {
        // check if note exists
        const note = await ProjectNote.findById(noteId).populate("project", "_id").lean()
        if(!note) {
            throw new ApiError(404, "Note not found");
        }

        // check if the user is creator of the note or a project admin
        const isCreator = note.createdBy.equals(userId)
        const isAdmin = await isProjectAdmin(note.project._id, userId)
        if (!isCreator && !isAdmin) {
            throw new ApiError(403, "You are not authorized to delete this note");
        }

        // delete the note
        await ProjectNote.findByIdAndDelete(noteId, { session })

        // return response
        return res.status(200).json(
            new ApiResponse(200, null, "Note deleted successfully")
        )

    } catch (error) {
        console.error("Error deleting note: ", error);
        throw new ApiError(500, "Internal server error while deleting note");
    }
});

/**
 * @description Get notes by project id
 * @param { string } projectId - id of the project
 * query { object } various filter parameters (page, limit, sort, order)
 * @route GET /api/v1/projects/:projectId/notes
 * @access Private (Project members only)
 */
const getNoteByProjectId = asyncHandler(async (req, res) => {
    const { projectId } = req.params
    const { page = 1, limit = 10, sort = "createdAt", order = "desc" } = req.query
    const userId = req.user._id

    // check if project id is present
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, "Invalid project ID");
    }

    try {
        // check if project exists
        const project = await Project.findById(projectId).select("_id createdBy").lean()
        if(!project) {
            throw new ApiError(404, "Project not found");
        }

        // check if the user is member of the project
        const isMember = await isProjectMember(projectId, userId)
        if (!isMember) {
            throw new ApiError(403, "You are not authorized to view notes in this project");
        }

        // prepare pagination
        const pageNumber = parseInt(page, 10) || 1
        const pageSize = parseInt(limit, 10) || 10
        const skip = (pageNumber - 1) * pageSize

        // create sort options
        const sortOptions = {}
        sortOptions[sort] = order === "asc" ? 1 : -1 // 1 for asc, -1 for desc

        // get total count of notes for the project
        const totalNotes = await ProjectNote.countDocuments({ project: projectId })

        // get notes
        const notes = await ProjectNote.find({ project: projectId })
            .populate({ path: "createdBy", select: "fullName email" })
            .populate({ path: "project", select: "name" })
            .sort(sortOptions)
            .skip(skip)
            .limit(pageSize)
            .lean()

        // return response
        return res.status(200).json(
            new ApiResponse(200, {
                notes,
                pagination: {
                    totalNotes,
                    page: pageNumber,
                    limit: pageSize,
                    pages: Math.ceil(totalNotes / pageSize)
                }
            }, "Notes fetched successfully")
        )
    } catch (error) {
        console.error("Error fetching notes: ", error);
        throw new ApiError(500, "Internal server error while fetching notes");
    }
    
});



export {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getNoteByProjectId,
};