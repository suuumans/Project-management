
import mongoose, { Schema } from "mongoose";
import { UserRolesEnum, AvailableUserRoles } from "../utils/constants.js";

const projectMemberSchema = new mongoose.Schema({
    users: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    role: {
        type: String,
        enum: AvailableUserRoles,
        default: UserRolesEnum.MEMBER,
        required: true
    }
}, { timestamps: true });

export const ProjectMember = mongoose.model("ProjectMember", projectMemberSchema);