
import { Project } from "../models/project.model";
import { asyncHandler } from "../utils/asyncHandler";
import { isProjectMember, isProjectAdmin, isValidDate } from "../utils/helper";
import { ApiError } from "../utils/apiError";
import mongoose from "mongoose";
import { Task } from "../models/task.model";
import { AvailableTaskStatus, TaskStatusEnum, AvailableTaskPriorities, TaskPrioritiesEnum } from "../utils/constants";
import { ApiResponse } from "../utils/apiResponse";
import { User } from "../models/user.model";



/**
 * @description Get all tasks
 * @query { string } projectId - id of the project
 * @query { object } various filter parameters (status, priority, assignedTo, dueDate, search)
 * @route GET /api/projects/:projectId/tasks
 * @access Private (Project members only)
 */
const getProjectTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  const { sort = "createdAt", order = "desc", status, assignedTo, search, priority } = req.query

  
  try {

    // check if project id is present and valid
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new ApiError(400, "Invalid project ID");
    }

    // check if project exists
    const project = await Project.findById(projectId).select("_id").lean()
    if(!project) {
      throw new ApiError(404, "Project not found");
    }

    // check if the user is member of the project
    const isMember = await isProjectMember(projectId, req.user._id)
    if (!isMember) {
      throw new ApiError(403, "You are not authorized to view this project tasks");
    }

    // calculate pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // create sorting options
    const sortOptions = {}
    sortOptions[sort] = order === "asc" ? 1 : -1

    // filter the object
    const filter = { project: projectId }

    // add filters based on query parameters
    if (status && AvailableTaskStatus.includes(status.toLowerCase())) {
      filter.status = status.toLowerCase()
    }

    // filter by assignedTo
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      filter.assignedTo = assignedTo
    }

    // filter by priority
    if (priority && AvailableTaskPriorities.includes(priority.toLowerCase())) {
      filter.priority = priority.toLowerCase()
    }

    // handel text search
    if (search && typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search }

      // or filter by title or description

      // filter.$or = [
      //   { title: { $regex: search, $options: "i" } },
      //   { description: { $regex: search, $options: "i" } }
      // ]
    }

    // get total number of tasks for the project
    const totalTasks = await Task.countDocuments(filter)

    // get all the tasks for the project with pagination and sorting options
    const tasks = await Task.find(filter)
      .populate({ path: "assignedTo", select: "fullName email" })
      .populate({ path: "assignedBy", select: "fullName email" })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean()

    // return response with pagination
    return res.status(200).json(
      new ApiResponse(200, {
        tasks,
        pagination: {
          total: totalTasks,
          limit: limit,
          page: page,
          pages: Math.ceil(totalTasks / limit)
        },
        filters: {
          status,
          assignedTo,
          search,
          priority
        }
      }, "Project tasks fetched successfully",)
    )
  } catch (error) {
    console.error('Error getting project tasks:', error);
    throw new ApiError(500, "Internal server error while getting project tasks")
  }
});

/**
 * @description Get single task by id
 * @param { string } taskId - id of the task
 * @route GET /api/v1/tasks/:taskId
 * @access Private (Project members only)
 */
const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params

  // check if task id is present and valid
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }

  try {
    // check task by ID with populated fields
    const task = await Task.findById(taskId)
      .populate({ path: "assignedTo", select: "fullName email" })
      .populate({ path: "assignedBy", select: "fullName email" })
      .populate({ path: "project", select: "name" })
      .lean()

    // check if task exists
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    // check if the member is the member of the project
    const isMember = await isProjectMember(task.project._id, req.user._id)
    if (!isMember) {
      throw new ApiError(403, "You are not authorized to view this task");
    }

    // return response
    return res.status(200).json(
      new ApiResponse(200, { task }, "Task fetched successfully")
    )
  } catch (error) {
    console.error('Error getting task:', error);
    throw new ApiError(500, "Internal server error while getting task");
  }
});

/**
 * @description Create task
 * @param { string } projectId - id of the project
 * @body { string } title, description, dueDate, priority, assignedTo
 * @route POST /api/v1/projects/:projectId/tasks
 */
const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  const { title, description, dueDate, priority = TaskPrioritiesEnum.MEDIUM, assignedTo } = req.body

  // check if project id is present and valid
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  // check and validate title
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new ApiError(400, "Title is required");
  }

  try {
    // check if project exists
    const project = await Project.findById(projectId).select("_id").lean()
    if(!project) {
      throw new ApiError(404, "Project not found");
    }

    // check if the the member of the project and is allowed to create task
    const isMember = await isProjectMember(projectId, req.user._id)
    if (!isMember) {
      throw new ApiError(403, "You are not authorized to create task in this project");
    }

    // check if assigned to user exists and is a member of the project
    let assignedToUser = null
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        throw new ApiError(400, "Invalid assignedTo user ID");
      }
      
      // check if assigned to user exists
      assignedToUser = await User.findById(assignedTo).select("_id").lean()
      if (!assignedToUser) {
        throw new ApiError(404, "Assigned to user not found");
      }
      
      // check if assigned to user is a member of the project
      const isUserMember = await isProjectMember(projectId, assignedTo)
      if (!isUserMember) {
        throw new ApiError(403, "Assigned to user is not a member of the project");
      }
    }

    // validate priority if present
    if (priority && !AvailableTaskPriorities.includes(priority.toLowerCase())) {
      throw new ApiError(400, `Invalid priority - Valid priorities are ${AvailableTaskPriorities.join(", ")}`);
    }

    // validate due date if present
    if (dueDate && !isValidDate(dueDate)) {
      throw new ApiError(400, "Invalid due date");
    }

    // create task
    const taskData = {
      title: title.trim(),
      description: description || "",
      project: projectId,
      assignedBy: req.user._id,
      assignedTo: assignedToUser ? assignedToUser._id : null, // if assignedTo is not provided, it will be null
      dueDate: dueDate ? new Date(dueDate) : null, // if dueDate is not provided, it will be null
      priority: priority ? priority.toLowerCase() : TaskPrioritiesEnum.MEDIUM
    }

    // using a mongoose session to ensure data consistency
    const session = await mongoose.startSession()
    let createdTask = null

    try {
      // start a transaction
      session.startTransaction()

      // create the task include session
      const [task] = await Task.create([taskData], { session })

      // populate fields for the response
      const createdTask = await Task.findById(task._id)
        .populate({ path: "assignedTo", select: "fullName email" })
        .populate({ path: "assignedBy", select: "fullName email" })
        .session(session)
        .lean()

      // commit the transaction
      await session.commitTransaction()

      // return response
      return res.status(201).json(
        new ApiResponse(201, { task: createdTask }, "Task created successfully")
      )

    } catch (error) {
      console.error("Error during task creation transaction: ", error);
      // abort the transaction
      await session.abortTransaction()

      throw new ApiError(500, error?.message || "Failed to create task due to a database error");
    } finally {
      // end the session
      await session.endSession()
    }
  } catch (error) {
    console.error('Error creating task:', error);
    throw new ApiError(500, "Internal server error while creating task");
  }
});

/**
 * @description Update task by id
 * @param { string } taskId - id of the task
 * @body { string } title, description, status, priority, dueDate, assignedTo
 * @route PUT /api/v1/tasks/:taskId
 * @access Private (Task creator, assignedto members or project admin)
 */
const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params
  const { title, description, status, priority, dueDate, assignedTo } = req.body

  // check if task id is present
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }

  // atleast one field should be updated
  if (Object.keys(req.body).length === 0) {
    throw new ApiError(400, "At least one field is required to update")
  }

  try {
    // check if the task exists
    const task = await Task.findById(taskId).select("project assignedBy assignedTo").lean()
    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    // check if the user is authorized to update the task
    const isMember = await isProjectMember(task.project, req.user._id)
    if (!isMember) {
      throw new ApiError(403, "You are not authorized to update this task");
    }

    // additional authorization checks - only task creator, assignedto members or project admin can update the task
    const isAssigned = task.assignedTo && task.assignedTo.equals(req.user._id)
    const isCreator = task.assignedBy.equals(req.user._id)
    const isAdmin = await isProjectAdmin(task.project._id, req.user._id)

    if (!isAssigned && !isCreator && !isAdmin) {
      throw new ApiError(403, "You are not authorized to update this task");
    }

    // check if assigned to user exists and is a member of the project
    if (assignedTo && (!task.assignedTo || !task.assignedTo?.equals(assignedTo))) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        throw new ApiError(400, "Invalid assignedTo user ID");
      }

      // check if assigned to user exists
      const assignedToUser = await User.findById(assignedTo).select("_id").lean()
      if (!assignedToUser) {
        throw new ApiError(404, "Assigned to user not found");
      }

      // check if assigned to user is a member of the project
      const isUserMember = await isProjectMember(task.project._id, assignedTo)
      if (!isUserMember) {
        throw new ApiError(403, "Assigned to user is not a member of the project");
      }
    }

    // check status if provided
    if (status && !AvailableTaskStatus.includes(status.toLowerCase())) {
      throw new ApiError(400, `Invalid status - Valid statuses are ${AvailableTaskStatus.join(", ")}`);
    }

    // check priority if provided
    if (priority && !AvailableTaskPriorities.includes(priority.toLowerCase())) {
      throw new ApiError(400, `Invalid priority - Valid priorities are ${AvailableTaskPriorities.join(", ")}`);
    }

    // check dueDate if provided
    if (dueDate && !isValidDate(dueDate)) {
      throw new ApiError(400, "Invalid due date");
    }
    
    // create update object
    const updateData = {}

    // update title if present
    if (title !== undefined && typeof title === "string") {
      const titleTrimmed = title.trim()
      if (titleTrimmed) {
        updateData.title = titleTrimmed;
      } else {
        throw new ApiError(400, "Title is required and cannot be empty");
      }
    }

    // update description if present
    if (description !== undefined) {
      updateData.description = description;
    }

    // update status if present
    if (status && AvailableTaskStatus.includes(status.toLowerCase())) {
      updateData.status = status.toLowerCase();
    }

    // update priority if present
    if (priority && AvailableTaskPriorities.includes(priority.toLowerCase())) {
      updateData.priority = priority.toLowerCase();
    }

    // update dueDate if present
    if (dueDate !== undefined) {
      if (dueDate !== null || dueDate === "") {
        updateData.dueDate = null
      } else if (isValidDate(dueDate)) {
        updateData.dueDate = new Date(dueDate);
      } else {
        throw new ApiError(400, "Invalid due date format or value provided for update");
      }
    }

    // update assignedTo if present
    if (assignedTo) {
      updateData.assignedTo = assignedTo;
    }

    // update task
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: updateData },
      { new: true, runValidators: true } // new: true returns the updated task, runValidators: true validates the schema validtions on update
    )
    .populate({ path: "assignedTo", select: "fullName email" })
    .populate({ path: "assignedBy", select: "fullName email" })
    .populate({ path: "project", select: "name" })
    .lean() // using leam for plain js object response

    // return response
    return res.status(200).json(
      new ApiResponse(200, {task: updatedTask}, "Task updated successfully")
    )
    
  } catch (error) {
    console.error('Error updating task:', error);
    throw new ApiError(500, "Internal server error while updating task");
  }
})


/**
 * @description Delete task by id
 * @param { string } taskId - id of the task from URL parameters
 * @route DELETE /api/v1/tasks/:taskId
 * @access Private ( Project Admins and Creators only )
 */
const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params

  // check if task id is present
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }

  try {
    // check if task exists
    const task = await Task.findById(taskId).populate("project assignedBy").lean()

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    // Check if the member has permission to delete the task (creator or admin)
    const isCreator = task.assignedBy.equals(req.user._id)
    const isAdmin = await isProjectAdmin(task.project._id, req.user._id)

    if (!isCreator && !isAdmin) {
      throw new ApiError(403, "You are not authorized to delete this task");
    }

    // let's use a session to ensure data consistency when deleting related data (like substacks)
    const session = await mongoose.startSession()

    try {
      // start a transaction
      session.startTransaction()

      // delete the task
      await Task.findByIdAndDelete(taskId, { session })

      // delete any substacks associated with the task
      if (mongoose.models.SubTask) {
        await mongoose.models.SubTask.deleteMany({ task: taskId }, { session })
      } else {
        console.warn("SubTask model not found or registered. Skipping subtask deletion.");
      }

      // commit the transaction
      await session.commitTransaction()

      // return response
      return res.status(200).json(
        new ApiResponse(200, {}, "Task deleted successfully")
      )

    } catch (error) {
      // abort the transaction
      await session.abortTransaction()
    } finally {
      // end the session
      await session.endSession()
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    throw new ApiError(500, "Internal server error while deleting task");
  }
});

/**
 * @description Get all tasks assigned to the current user
 * @query { object } various filter parameters (status, priority, assignedTo, dueDate, search)
 * @route GET /api/v1/tasks
 * @access Private (Task creator, assignedto members or project admin)
 */
const getMyTasks = asyncHandler(async (req, res) => {
  const { status, priority, projectId, search, page = 1, limit = 10, sort = "createdAt", order = "desc" } = req.query

   try {
    // prepare pagination
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // create sort options
    const sortOptions = {}

    const allowedSortFields = ['createdAt', 'dueDate', 'priority', 'title'];
    if (allowedSortFields.includes(sort)) {
      sortOptions[sort] = order === "asc" ? 1 : -1;
    } else {
      sortOptions["createdAt"] = -1; // Default sort if invalid field provided
    }

    // filter the object
    const filter = { assignedTo: req.user._id }

    // add filters based on status parameter
    if (status && AvailableTaskStatus.includes(status.toLowerCase())) {
      filter.status = status.toLowerCase()
    }

    // add filters based on priority parameter
    if (priority && AvailableTaskPriorities.includes(priority.toLowerCase())) {
      filter.priority = priority.toLowerCase()
    }

    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      // check if the user is member of the project
      const isMember = await isProjectMember(projectId, req.user._id)
      if (!isMember) {
        throw new ApiError(403, "You are not authorized to view this project tasks");
      }

      // add project filter
      filter.project = projectId
    
    }

    // add search filter for title
    if (search && typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search.trim() }

      // or filter by title or description
      // filter.$or = [
      //   { title: { $regex: search, $options: "i" } },
      //   { description: { $regex: search, $options: "i" } }
      // ]
    }

    // get total count for pagination
    const totalTasks = await Task.countDocuments(filter)

    // get task with pagination, sorting and filtering
    const tasks = await Task.find(filter)
      .populate({ path: "project", select: "name" })
      // .populate({ path: "assignedBy", select: "fullName email" })
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber)
      .lean()

    // return response with pagination
    return res.status(200).json(
      new ApiResponse(200, {
        tasks,
        pagination: {
          total: totalTasks,
          limit: limitNumber,
          page: pageNumber,
          pages: Math.ceil(totalTasks / limitNumber)
        },
        filters: {
          status: filter.status,
          priority: filter.priority,
          projectId: filter.project,
          search: search?.trim() || undefined
        }
      }, "Tasks fetched successfully",)
    )

  } catch (error) {
    console.error('Error getting my tasks:', error);
    throw new ApiError(500, "Internal server error while getting my tasks");
  }
});

export {
  getProjectTask,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getMyTasks
}