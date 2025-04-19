
import { body } from "express-validator"

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

export { userRegistrationValidator, userLoginValidator, emailValidator, resetPasswordValidator, updateProfileValidator }