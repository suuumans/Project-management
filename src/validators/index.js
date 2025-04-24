
import { body } from "express-validator"
import { TaskPrioritiesEnum } from "../utils/constants.js"

// validate user registration credentials
const userRegistrationValidator = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email'),
        body('username')
            .trim()
            .notEmpty().withMessage('Username is required')
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
            .isLength({ max: 12 }).withMessage('Username must be at most 12 characters long'),
        body('password')
            .trim()
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
            .isLength({ max: 16 }).withMessage('Password must be at most 16 characters long')
            .matches(/\d/).withMessage('Password must contain at least one number')
            .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
            .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character')
    ]
}

// validate user login credentials
const userLoginValidator = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email'),
        body('password')
            .trim()
            .notEmpty().withMessage('Password is required')
    ]
}

// Validator for endpoints requiring just an email 
const emailValidator = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email'),
    ]
}

// validator for the reset password
const resetPasswordValidator = () => {
    return [
        body('token')
            .trim()
            .notEmpty().withMessage('Token is required'),
        body('password')
            .trim()
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
            .isLength({ max: 16 }).withMessage('Password must be at most 16 characters long')
            .matches(/\d/).withMessage('Password must contain at least one number')
            .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
            .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character')
    ]
}

// update profile validator
const updateProfileValidator = () => {
    return [
        body('fullName')
            .trim()
            .notEmpty().withMessage('Full name is required')
            .isLength({ min: 3 }).withMessage('Full name must be at least 3 characters long')
            .isLength({ max: 12 }).withMessage('Full name must be at most 12 characters long')
    ]
}

// change current password validator
const changeCurrentPasswordValidator = () => {
    return [
        body('currentPassword')
            .trim()
            .notEmpty().withMessage('Current password is required'),
        body('newPassword')
            .trim()
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
            .isLength({ max: 16 }).withMessage('New password must be at most 16 characters long')
            .matches(/\d/).withMessage('New password must contain at least one number')
            .matches(/[a-zA-Z]/).withMessage('New password must contain at least one letter')
            .matches(/[^a-zA-Z0-9]/).withMessage('New password must contain at least one special character')
    ]
}

// notes validator
const noteValidator = () => {
    return [
        body('content')
            .trim()
            .notEmpty().withMessage('Content is required')
            .isString().withMessage('Content must be a string')
            .isLength({ min: 1 }).withMessage('Content must be at least 1 characters long')
            .isLength({ max: 1000 }).withMessage('Content must be at most 1000 characters long')
            
    ]
}

// create project validator
const projectValidator = () => {
    return [
        body('name')
            .trim()
            .notEmpty().withMessage('Project name is required')
            .isString().withMessage('Project name must be a string')
            .isLength({ min: 3 }).withMessage('Project name must be at least 3 characters long')
            .isLength({ max: 12 }).withMessage('Project name must be at most 12 characters long'),
        
        body('description')
            .trim()
            .isString().withMessage('Description must be a string')
            .isLength({ max: 300 }).withMessage('Description must be at most 300 characters long')
    ]
}

// create task validator
const createTaskValidator = () => {
    return [
        body('title')
            .trim()
            .notEmpty().withMessage('Title is required')
            .isString().withMessage('Title must be a string')
            .isLength({ min: 3 }).withMessage('Title must be at least 3 characters long')
            .isLength({ max: 23 }).withMessage('Title must be at most 23 characters long'),
        
        body('description')
            .trim()
            .isString().withMessage('Description must be a string')
            .isLength({ max: 300 }).withMessage('Description must be at most 300 characters long'),

        body('dueDate')
            .trim()
            .isDate().withMessage('Due date must be a valid date'),
        
        body('priority')
            .trim()
            .isIn([TaskPrioritiesEnum.LOW, TaskPrioritiesEnum.MEDIUM, TaskPrioritiesEnum.HIGH]).withMessage('Priority must be low, medium or high'),
        
        body('assignedTo')
            .trim()
            .isMongoId().withMessage('Assigned to must be a valid user ID')
    ]
}


export { 
    userRegistrationValidator,
    userLoginValidator,
    projectValidator,
    emailValidator,
    resetPasswordValidator,
    updateProfileValidator,
    changeCurrentPasswordValidator,
    noteValidator,
    createTaskValidator
 }