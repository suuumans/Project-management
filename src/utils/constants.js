
export const UserRolesEnum = {
    ADMIN: "admin",
    PROJECT_ADMIN: "project_admin",
    MEMBER: "member"
}
export const AvailableUserRoles = Object.values(UserRolesEnum)

export const TaskStatusEnum = {
    TODO: "todo",
    PRIORITY: "priority",
    IN_PROGRESS: "in_progress",
    IN_REVIEW: "in_review",
    CANCELLED: "cancelled",
    DONE: "done"
}
export const AvailableTaskStatus = Object.values(TaskStatusEnum)

export const TaskPrioritiesEnum = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high"
}
export const AvailableTaskPriorities = Object.values(TaskPrioritiesEnum)