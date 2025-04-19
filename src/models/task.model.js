
import mongoose, { Schema } from "mongoose";
import { AvailableTaskStatus, TaskStatusEnum, AvailableTaskPriorities, TaskPrioritiesEnum } from "../utils/constants.js";
const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: null
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: AvailableTaskStatus,
        default: TaskStatusEnum.TODO
    },
    priority: {
        type: String,
        enum: AvailableTaskPriorities,
        default: TaskPrioritiesEnum.MEDIUM
    },
    dueDate: {
        type: Date,
        default: null
    },
    attachments: {
        type: [
            {
                url: String,
                mimeType: String,
                size: Number
            }
        ],
        default: []
    }
}, { timestamps: true });


// add indexed fields for searching

// Index for sorting with project
taskSchema.index({ project: 1 });

// Index for sorting with assignedTo
taskSchema.index({ assignedTo: 1 });

// Index for sorting with status
taskSchema.index({ status: 1 });

// Index for sorting with priority
taskSchema.index({ priority: 1 });

// Index for sorting with creation date
taskSchema.index({ createdAt: -1 });

// Index for sorting with due date
taskSchema.index({ dueDate: 1 });

// Text index for search
taskSchema.index({ title: 'text', description: 'text' });

export const Task = mongoose.model("Task", taskSchema);