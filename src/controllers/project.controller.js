import { asyncHandler } from "../utils/asyncHandler.js";
import { Project } from "../models/project.model.js";
import { ProjectMember } from "../models/projectmember.model.js";
import mongoose from "mongoose";
import { AvailableTaskStatus, AvailableUserRoles, UserRolesEnum } from "../utils/constants.js";
import { Task } from "../models/task.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";


/**
 * @description checks if a User is a member or creator of a project
 * @param { string } projectId - id of the project
 * @param { string } userId - id of the user
 * @returns { boolean } true if user is a member or creator of the project, false otherwise
 */
const isProjectMember = async (projectId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }
  try {
    // check if project exists and user is creator
    const project = await Project.findById(projectId).select("createdBy").lean();
    if (!project) {
      console.warn(`Project not found in isProjectMember check: ${projectId}`);
      return false
    }

    // if user is creator, then they are also a member
    if (project.createdBy.toString() === userId.toString()) return true

    // check if user is a member of the project
    const member = await ProjectMember.findOne({
      project: projectId,
      users: userId
    }).select("_id").lean();
    return !!member // convert to boolean if member is found. ! !member means member is not found
    
  } catch (error) {
    console.error('Error checking project membership:', error);
    return false;
  }
}

/**
 * @description if a user has admin rights in a project ( creator or admin role )
 * @param { string } projectId - id of the project
 * @param { string } userId - id of the user
 * @returns { boolean } true if user is a member or creator of the project, otherwise false
 */
const isProjectAdmin = async (projectId, userId) => {
  // validate IDs first
  if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }

  try {
    // check if project exists and user is creator
    const project = await Project.findById(projectId).select("createdBy").lean();
    if (!project) {
      console.warn(`Project not found in isProjectAdmin check: ${projectId}`);
      return false
    }

    // check if user is the creator
    if (project.createdBy.equals(userId)) {
      return true;
    }

    // check if user is a member with admin role
    const member = await ProjectMember.findOne({
      project: projectId,
      users: userId
    }).select("role").lean();

    // return true if member is found and role is admin
    return member && member.role === UserRolesEnum.ADMIN
    
  } catch (error) {
    console.error('Error checking project admin rights:', error);
    return false;
  }
}

/**
 * @description Get all projects (created by user id OR is a member of)
 * @route GET /api/projects
 * @access Private
 */
const getProjects = asyncHandler(async (req, res) => {
  try {
    // get projects the user created OR is a member of
    const userMemberOf = await ProjectMember.find({ users: req.user._id }).select("project");
    const memberProjectsIds = userMemberOf.map(member => member.project);
    const project = await Project.find({
      $or: [
        { createdBy: req.user._id },
        { _id: { $in: memberProjectsIds }}
      ]
    }).populate("createdBy", "fullName email");
  
    // return response
    return res.status(200).json(
      new ApiResponse(200, {projects: project}, "Projects fetched successfully" )
    )
  } catch (error) {
    console.error('Error getting projects:', error);
    throw new ApiError(500, "Internal server error while getting projects");
  }
});

/**
 * @description Get single project by id
 * @route GET /api/projects/:projectId
 * @access Private (User must be a creator or a member of the project)
 */
const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params

  // check if project id is present
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  const project = await Project.findById(projectId)
    .populate("createdBy", "fullName email")

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // authorization check using the helper function isProjectMember
  const authorized = await isProjectMember(projectId, req.user._id)

  // check if user is authorized
  if (!authorized) {
    throw new ApiError(403, "You are not authorized to access this project");
  }

  // return response
  return res.status(200).json(
    new ApiResponse(200, {project}, "Project fetched successfully" )
  )
});

/**
 * @description Create a new project
 * @body { string } name, description
 * @route POST /api/v1/projects
 * @access Private
 */
const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // check if name is present
  if (!name.trim()) {
    throw new ApiError(400, "Project name is required");
  }

  // start a session
  const session = await mongoose.startSession();

  try {
    // start a transaction
    session.startTransaction();

    // create the project include session
    const projectData = {
      name,
      description: description || "",
      createdBy: req.user._id
    }
    const [project] = await Project.create([projectData], { session });

    // add the creator as a member and admin of the project
    await ProjectMember.create([{
      users: req.user._id,
      project: project._id,
      role: UserRolesEnum.ADMIN
    }], { session })

    // fetch the created project with populated fields
    const createdProject = await Project.findById(project._id)
      .populate("createdBy", "fullName email")
      .session(session);

    // commit the transaction
    await session.commitTransaction();

    // end the session
    await session.endSession();

    // return response
    return res.status(201).json(
      new ApiResponse(201, {project: createdProject}, "Project created successfully" )
    )
  } catch (error) {
    // abort the transaction
    await session.abortTransaction();
    await session.endSession();

    console.error('Error creating project:', error);
    // handel dispute project name error
    if (error.code === 11000) {
      throw new ApiError(400, "A project with this Project name already exists");
    }
    throw new ApiError(500, "Internal server error while creating project");
  }
});

/**
 * @description Update a project
 * @param { string } projectId - id of the project
 * @param { object } reqBody - request body
 * @route PUT /api/projects/:projectId
 * @access Private ( Admin only )
 */
const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  const { name, description } = req.body;

  // check if project id is present
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  // validate at least one field is updated
  if ((!name || !name.trim()) && description === undefined) {
    throw new ApiError(400, "At least one field is required to update");
  }

  try {
    // check if project exists
    const project = await Project.findById(projectId).select("_id").lean()

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // check if the user has admin access to the project
    const hasAdminAccess = await isProjectAdmin(projectId, req.user._id)

    if (!hasAdminAccess) {
      throw new ApiError(403, "You are not authorized to update this project");
    }

    // prepare update object
    const updateData = {}
    // update the name if present 
    if (name && name.trim()) {
      updateData.name = name;
    }

    // update the description if present
    if (description !== undefined) {
      updateData.description = description;
    }

    // update the project
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $set: updateData },
      { new: true }
    ).populate("createdBy", "fullName email").lean();

    // return response
    return res.status(200).json(
      new ApiResponse(200, {project: updatedProject}, "Project updated successfully" )
    )
  } catch (error) {
    console.error('Error updating project:', error);
    // handel dispute project name error
    if (error.code === 11000) {
      throw new ApiError(400, "A project with this Project name already exists");
    }
    throw new ApiError(500, "Internal server error while updating project");
  }
});

/**
 * @description Delete a project
 * @param { string } projectId - id of the project
 * @route DELETE /api/projects/:projectId
 * @access Private ( Admin only )
 */
const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params

  // check if project id is present
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  try {
    // check if project exists
    const project = await Project.findById(projectId).select("_id").lean()

    // check if project exists
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // check if the user has admin access to the project
    const hasAdminAccess = await isProjectAdmin(projectId, req.user._id)
    if (!hasAdminAccess) {
      throw new ApiError(403, "You are not authorized to delete this project");
    }

    // using a transaction to delete the project and its members as it is a one to many relationship
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // delete the project
      await Project.findByIdAndDelete(projectId, { session });

      // delete the project members
      await ProjectMember.deleteMany({ project: projectId }, { session });

      // delete all the tasks associated with the project
      await Task.deleteMany({ project: projectId }, { session });

      // commit the transaction
      await session.commitTransaction();

      // return response
      return res.status(200).json(
        new ApiResponse(200, null, "Project and all associated data deleted successfully" )
      )
    } catch (error) {
      // abort the transaction
      await session.abortTransaction();
      session.endSession();

      console.error('Error deleting project:', error);
    }
    // return response
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new ApiError(500, "Internal server error while deleting project");
  }
});

/**
 * @description Add a member to a project
 * @param { string } projectId - id of the project
 * @body { string } email, role - id of the user to add and role of the user in the project
 * @route POST /api/projects/:projectId/members
 * @access Private ( Admin only )
 */
const addMemberToProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  const { email, role } = req.body

  // check if project id is present
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  // check if user id is present
  if (!email || typeof email !== "string" || !email.trim()) {
    throw new ApiError(400, "Invalid email ID - Valid email is required");
  }

  // role validation
  const memberRoleInput = role ? role.toLowerCase() : UserRolesEnum.MEMBER

  // check if the role is provided
  if (role && AvailableUserRoles.includes(memberRoleInput)) {
    throw new ApiError(400, `Invalid role - Valid roles are ${AvailableUserRoles.join(", ")}`);
  }
  

  try {
    // check if project exists
    const project = await Project.findById(projectId).select("_id createdBy").lean()

    // check if project exists
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // check if the user has admin access to the project
    const hasAdminAccess = await isProjectAdmin(projectId, req.user._id)
    if (!hasAdminAccess) {
      throw new ApiError(403, "You are not authorized to add members to this project");
    }

    // check if user exists
    const userToAdd = await User.findOne({ email: email.toLowerCase() }).select(" _id fullNmae email ").lean()
    if (!userToAdd) {
      throw new ApiError(404, `User with email ${email} not found`)
    }

    // check if the user is already a member of the project
    const existingMember = await ProjectMember.findOne({
      project: projectId,
      users: userToAdd._id
    }).select("_id").lean();

    if (existingMember) {
      throw new ApiError(400, `User ${userToAdd.fullName} is already a member of the project`);
    }
    
    // add the member to the project with specified role
    const memberRole = AvailableUserRoles.includes(memberRoleInput) ? memberRoleInput : UserRolesEnum.MEMBER
    const newMember = await ProjectMember.create({
      project: projectId,
      users: userToAdd._id,
      role: memberRole
    })

    if (!newMember) {
      throw new ApiError(500, "Error adding member to project due to server error");
    }

    // populate the project with the new member for the response
    await newMember.populate({path: "users", select: "fullName email"})
      .populate({path: "project", select: "name"})
      .lean();
    
    // return response
    return res.status(201).json(
      new ApiResponse(201, {member: newMember}, "Member added to project successfully" )
    )
  } catch (error) {
    console.error('Error adding member to project:', error);
    throw new ApiError(500, "Internal server error while adding member to project");
  }
});

/**
 * @description remove member from the project
 * @param { string } projectId - id of the project
 * @param { string } userId - id of the user
 * @route DELETE /api/projects/:projectId/members/:userId
 * @access Private ( Admin only )
 */
const removeMemberFromProject = asyncHandler(async (req, res) => {
  const { projectId, memberId } = req.params

  // check if project id and memberId is present
  if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(memberId)) {
    throw new ApiError(400, "Invalid project ID or member ID");
  }
  try {
    // check if project exists
    const project = await Project.findById(projectId).select("createdBy").lean()

    // check if project exists
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // find the member to remove
    const memberToRemove = await ProjectMember.findOne({
      project: projectId,
      users: memberId
    }).select("user").lean()

    if (!memberToRemove) {
      throw new ApiError(404, "User not a member of this project");
    }

    // prevent removing the project creator
    if (project.createdBy.equals(memberId)) {
      throw new ApiError(400, "Project creator cannot be removed from the project");
    }

    // members can remove themselves from the project
    const selfRemoval = memberToRemove.users.equals(req.user._id)

    // Creator and Admin can remove other members from the project
    const isAdmin = await isProjectAdmin(projectId, req.user._id)

    // remove the member from the project
    await ProjectMember.findByIdAndDelete(memberToRemove._id)

    // return response
    return res.status(200).json(
      new ApiResponse(200, null, "Member removed from project successfully" )
    )
  } catch (error) {
      console.error('Error removing member from project:', error);
      throw new ApiError(500, "Internal server error while removing member from project");
  }
});

/**
 * @description Get all project members
 * @param { string } projectId - id of the project
 * @route GET /api/projects/:projectId/members
 * @access Private (Project members only)
 */
const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params

  // check if project id is present
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  try {
    // check if project exists
    const project = await Project.findById(projectId).select("createdBy").lean()
    if(!project) {
      throw new ApiError(404, "Project not found");
    }

    // check if the current user is member of the project
    const isMember = await isProjectMember(projectId, req.user._id)
    if (!isMember) {
      throw new ApiError(403, "You are not authorized to view this project members");
    }

    // fetch all the members of the project
    const members = await ProjectMember.find({ project: projectId })
      .populate({
        path: "users",
        select:"fullName email"
      })
      .sort({ createdAt: 1 }) // sort by join date, earliest to latest
      .lean()
      
      // add flag for project creator
      const projectCreatorAndMembers = members.map(member => {
        const isCreator = project.createdBy.equals(member.users._id)
        return{
          ...member, // spread the member object
          isCreator
        }
      })


    // return response
    return res.status(200).json(
      new ApiResponse(200, {members: projectCreatorAndMembers}, "Project members fetched successfully" )
    )
  } catch (error) {
    console.error('Error getting project members:', error);
    throw new ApiError(500, "Internal server error while getting project members");
  }
});

/**
 * @description Update project member role
 * @param { string } projectId - id of the project
 * @param { string } userId - id of the user
 * @route PATCH /api/projects/:projectId/members/:userId
 * @access Private (Only creator and admin only)
 */
const updateProjectMemberRole = asyncHandler(async (req, res) => {
  const { projectId, memberId } = req.params
  const { role } = req.body

  // check if the projectId and memberId is present
  if((!mongoose.Types.ObjectId.isValid(projectId)) || (!mongoose.Types.ObjectId.isValid(memberId))) {
    throw new ApiError(400, "Invalid project ID or member ID");
  }

  // check if the role is provided
  if (!role || !AvailableUserRoles.includes(role)) {
    throw new ApiError(400, `Invalid role - Valid roles are ${AvailableUserRoles.join(", ")}`);
  }

  try {
    // check if the project exists
    const project = await Project.findById(projectId).select("_id").lean()
    if(!project) {
      throw new ApiError(404, "Project not found");
    }

    // find the member to update role
    const memberToUpdatRole = await ProjectMember.findOne({
      project: projectId,
      users: memberId
    })

    if (!memberToUpdatRole) {
      throw new ApiError(404, "User not a member of this project");
    }

    // check if the current user is creator or admin of the project
    const isCreatorOrAdmin = await isProjectAdmin(projectId, req.user._id)
    if(!isCreatorOrAdmin) {
      throw new ApiError(403, "You are not authorized to update this project member role")
    }

    // update the role
    memberToUpdatRole.role = role
    const updatedMember = await memberToUpdatRole.save()

    // return response
    return res.status(200).json(
      new ApiResponse(200, { member: updatedMember }, "Project member role updated successfully")
    )
  } catch (error) {
    console.error("Error updating Project Member Role: ", error)
    throw new ApiError(500, "Internal server error while updating project member role")
  }
});

/**
 * @description Get all project tasks
 * @param { string } projectId - id of the project
 * @query { object } various filter parameters (status, priority, assignedTo, dueDate, search)
 * @query { number } page - Page number for pagination (default: 1)
 * @query { number } limit - Number of tasks per page (default: 10)
 * @query { string } sortBy - Field to sort by (default: createdAt)
 * @query { string } sortOrder - Sort order ('asc' or 'desc', default: desc)
 * @route GET /api/projects/:projectId/tasks
 * @access Private (Project members only)
 */
const getProjectTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  let { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", status, assignedTo, search } = req.query

  // check if project id is present and valid
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project ID");
  }

  page = parseInt(page, 10)
  limit = parseInt(limit, 10)
  page = page > 0 ? page : 1
  limit = limit > 0 ? limit : 10
  const skip = (page - 1) * limit

  // validate sorting parameters
  const allowedSortBy = ["createdAt", "updatedAt", "title", "status"]
  sortBy = allowedSortBy.includes(sortBy) ? sortBy : "createdAt"
  sortOrder = sortOrder.toLowerCase() === "asc" ? 1 : -1 // 1 for asc, -1 for desc

  const sortOptions = {}
  sortOptions[sortBy] = sortOrder
  

  try {
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

    // filter object dynamically
    const filter = { project: projectId }

    // add filters based on query parameters
    if (status && AvailableTaskStatus.includes(status.toLowerCase())) {
      filter.status = status.toLowerCase()
    }

    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      filter.assignedTo = assignedTo
    }

    // handel text search
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim()
      const searchRegex = new RegExp(searchTerm, 'i')
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ]
    }

    // get total count for pagination
    const totalTasks = await Task.countDocuments(filter)

    // get all the tasks for the project with pagination and sorting
    const tasks = await Task.find(filter)
      .populate("asignedTo", "fullName email")
      .populate("asignedBy", "fullName email")
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
          search
        }
      }, "Project tasks fetched successfully",
    )
  )
  } catch (error) {
    console.error('Error getting project tasks:', error);
    throw new ApiError(500, "Internal server error while getting project tasks");
  }
});

export {
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
}