
import { Router } from "express";
import { changeCurrentPassword,
    forgetPassword,
    getUserProfile,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    resendVerificationEmail,
    resetPassword,
    updateUserProfile,
    verifyUser
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validator.middleware.js";
import { userLoginValidator,
    userRegistrationValidator,
    emailValidator,
    resetPasswordValidator,
    updateProfileValidator,
    changeCurrentPasswordValidator
} from "../validators/index.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// ------ Public routes (No auth required) ------
router.route('/register').post(userRegistrationValidator(), validate, registerUser)
router.route('/login').post(userLoginValidator(), validate, loginUser)
router.route('/verify-email/:token').get(verifyUser)
router.route('/resend-verification-email').post(emailValidator(), validate, resendVerificationEmail)
router.route('/refresh-token').post(refreshAccessToken)
router.route('forget-password').post(emailValidator(), validate, forgetPassword)
router.route('/reset-password').post(resetPasswordValidator(), validate, resetPassword)

// ------ Private routes (Auth required) ------
router.use(verifyJWT)
router.route('/logout').post(logoutUser)
router.route('/profile').get(getUserProfile)
router.route('/profile').put(updateProfileValidator(), validate, updateUserProfile)
router.route('/change-password').post(changeCurrentPasswordValidator(), validate, changeCurrentPassword)


export default router