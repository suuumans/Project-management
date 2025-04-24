
import { Project } from "../models/project.model.js";
import { ProjectMember } from "../models/projectmember.model.js";


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

const isValidDate = (date) => {
  return !isNaN(new Date(date).getDate())
}


export { isProjectMember, isProjectAdmin, isValidDate }