
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/apiError"
import { ApiResponse } from "../utils/apiResponse"
import dotenv from "dotenv"
dotenv.config()
import User from "../models/user.model"
import { sendMail, emailVerificationGenContent } from "../utils/mail"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import { access } from "fs"


// register user
const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password, role } = req.body;
    // validation
    if (!fullName || !email || !password || !role) {
        throw new ApiError(400, "All fields are required");
    }

    try {
        // check if user already exists
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            throw new ApiError(400, "User already exists");
        }
        // create user
        const newUser = await User.create({ fullName, email, password, role });
        // check if user is created successfully
        if (!newUser) {
            throw new ApiError(400, "User not created");
        } else {
            // generate verification token
            const { hashedToken, unHashedToken, tokenExpiry } = await newUser.generateTemporaryToken();
            // set the verification token field
            newUser.emailVerificationToken = hashedToken;
            newUser.emailVerificationTokenExpiry = tokenExpiry;
            await newUser.save();
            // create verification url for email
            const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${unHashedToken}`
            // Generate email content using utils mail.js
            const mailGenContent = emailVerificationGenContent(newUser.fullName, verificationUrl);
            // send verification email
            try {
                await sendMail({
                    email: newUser.email,
                    subject: "Verify your email address",
                    mailGenContent
                })
                return res.status(201).json(
                    new ApiResponse(201, {
                        user: {
                            _id: newUser._id,
                            name: newUser.fullName,
                            email: newUser.email,
                            role: newUser.role
                        }
                    }, "User registered successfully. Please check your email to verify your account." )
                )
            } catch (error) {
                console.error('Error sending verification email:', error);
                throw new ApiError(500, "Internal server error while sending verification email");
            }
        }
    } catch (error) {
        console.error('Error registering user:', error);
        throw new ApiError(500, "Internal server error while registering user");
    }

})

// login user
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // check if email and password are present
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    try {
        //  check if user exists by email
        const user = await User.findOne({ email });
        if (!user) {
            throw new ApiError(404, "User not found, please register first");
        }

        // check if user is verified
        if (!user.isEmailVerified) {
            throw new ApiError(401, "User not verified, please verify your email");
        }
        
        // check if password is correct
        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) {
            throw new ApiError(401, "Invalid password");
        }

        // generate access token & refresh token
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        // update user refresh token in database
        user.refreshToken = refreshToken;
        user.refreshTokenExpiry = Date.now() + process.env.REFRESH_TOKEN_EXPIRY;
        await user.save();

        // set cookies for access token & refresh token
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }

        res.cookie("accessToken", accessToken, cookieOptions);
        res.cookie("refreshToken", refreshToken, cookieOptions);

        // return response
        return res.status(200).json(
            new ApiResponse(200, {
                user: {
                    _id: user._id,
                    fullname: user.fullName,
                    email: user.email,
                    role: user.role
                }
            }, "User logged in successfully" )
        )
    } catch (error) {
        console.error('Error logging in user:', error);
        throw new ApiError(500, "Internal server error while logging in user");
    }
})

// logout user
const logoutUser = asyncHandler(async (req, res) => {
    // Get the user id from the request
    const userId = req.user?._id

    // check if user id is present
    if (!userId) {
        throw new ApiError(401, "Unauthorized request - user id not found");
    }

    try {
        // Find and update the user to remove the refresh token
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $unset: {
                    refreshToken: 1,
                    refreshTokenExpiry: 1
                }
            },
            {
                new: true
            }
        )

        // define cookie options for clearing cookies
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }

        // clear both tokens from cookies
        res.clearCookie("accessToken", "", cookieOptions);
        res.clearCookie("refreshToken", "", cookieOptions);

        // return response
        return res.status(200).json(
                new ApiResponse(200, {}, "User logged out successfully" )
            )
    } catch (error) {
        console.error('Error logging out user:', error);
        throw new ApiError(500, "Internal server error while logging out user");
    }
})

// verify user
const verifyUser = asyncHandler(async (req, res) => {
    const { token } = req.params
    // check if token is present
    if (!token) {
        throw new ApiError(400, "Verification token is required");
    }
    
    // hash the recived token to compare with the one in the database
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    
    try {
        // find the user with the hashed token that hasn't expired
        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationTokenExpiry: { $gt: Date.now() }
        })
        
        if (!user) {
            throw new ApiError(400, "Invalid verification token");
        }
    
        // update user verification status
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpiry = undefined;
    
        // save the user without validating as the user has already been verified
        await user.save({ validateBeforeSave: false });

        return res.status(200).json(
            new ApiResponse(200, {}, "User verified successfully" )
        )
    } catch (error) {
        console.error('Error verifying user:', error);
        throw new ApiError(500, "Internal server error while verifying user");
    }
})

// resend verification email
const resendVerificationEmail = asyncHandler(async (req, res) => {
    // get email from request body
    const { email } = req.body

    // check if email is present
    if (!email) {
        throw new ApiError(400, "Email is required");
    }
    try {
        // find user by email
        const user = await User.findOne({ email })
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // check if user is already verified
        if (user.isEmailVerified) {
            throw new ApiError(400, "User is already verified");
        }

        // generate new verification token
        const { hashedToken, unHashedToken, tokenExpiry } = await user.generateTemporaryToken();
        
        // set the verification token field
        user.emailVerificationToken = hashedToken;
        user.emailVerificationTokenExpiry = tokenExpiry;
        await user.save();

        // create verification url for email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${unHashedToken}`

        // Generate email content using utils mail.js
        const mailGenContent = emailVerificationGenContent(user.fullName, verificationUrl);

        // send verification email
        try {
            await sendMail({
                email: user.email,
                subject: "Verify your email address",
                mailGenContent
            });
            return res.status(200).json(
                new ApiResponse(200, null, "Verification email sent successfully" )
            )
        } catch (error) {
            console.error('Error sending verification email:', error);
            throw new ApiError(500, "Internal server error while sending verification email");
        }
    } catch (error) {
        console.error('Error resending verification email:', error);
        throw new ApiError(500, "Internal server error while resending verification email");
    }
})

// refesh token access
const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        // get refresh token from incomming cookies
        const incommingRefreshToken = req.cookies?.refreshToken;
    
        // check if refresh token is present
        if (!incommingRefreshToken) {
            throw new ApiError(401, "Unauthorized request - refresh token not found");
        }

        // verify the refresh token using jwt
        const decodedToken = jwt.verify(
            incommingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        // find user with this refresh token
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // check if the refresh token has expired
        if (user.refreshTokenExpiry < Date.now()) {
            throw new ApiError(401, "Refresh token has expired");
        }

        // check if incomming refresh token matches the one in the database
        if (incommingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // generate new access token & refresh token
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        // create cookie options
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }

        // set cookies for access token & refresh token
        res.cookie("accessToken", accessToken, cookieOptions);
        res.cookie("refreshToken", refreshToken, cookieOptions);

        // update user refresh token in database
        user.refreshToken = refreshToken;
        user.refreshTokenExpiry = Date.now() + process.env.REFRESH_TOKEN_EXPIRY;
        await user.save({ validateBeforeSave: false });

        // return response
        return res.status(200).json(
            new ApiResponse(200, { accessToken, accessTokenExpiry: user.accessTokenExpiry }, "User logged in successfully" )
        )
    } catch (error) {
        console.error('Error refreshing access token:', error);
        throw new ApiError(500, "Internal server error while refreshing access token");
    }
})

// forget password
const forgetPassword = asyncHandler(async (req, res) => {
    // get email from request body
    const { email } = req.body

    // check if email is present
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    try {
        // find user by email
        const user = await User.findOne({ email })
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // generate new password reset token
        const { hashedToken, unHashedToken, tokenExpiry } = user.generateTemporaryToken();

        // save reset token to database
        user.passwordResetToken = hashedToken;
        user.passwordResetTokenExpiry = tokenExpiry;
        await user.save({ validateBeforeSave: false });

        // create password reset url for email
        const passwordResetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${unHashedToken}`

        // Generate email content using utils mail.js
        const mailGenContent = forgotPasswordGenContent(user.fullName, passwordResetUrl);

        // send password reset email
        await sendMail({
            email: user.email,
            subject: "Reset your password",
            mailGenContent
        })

        // return response
        return res.status(200).json(
            new ApiResponse(200, null, "Password reset email sent successfully" )
        )
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new ApiError(500, "Internal server error while sending password reset email");
    }
})

// reset password
const resetPassword = asyncHandler(async (req, res) => {
    // get token and password from request body
    const { token, password } = req.body

    // check if token and password are present
    if (!token || !password) {
        throw new ApiError(400, "Token and password are required");
    }

    try {
        // hash the recived token to compare with the one in the database
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        // find user with the hashed token that hasn't expired yet
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetTokenExpiry: { $gt: Date.now() }
        })

        if (!user) {
            throw new ApiError(400, "Invalid password reset token");
        }

        // update user password
        user.password = password;

        // clear password reset token
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpiry = undefined;

        // save user
        await user.save({ validateBeforeSave: false });

        // return response
        return res.status(200).json(
            new ApiResponse(200, null, "Password reset successfully" )
        )
    } catch (error) {
        console.error('Error resetting password:', error);
        throw new ApiError(500, "Internal server error while resetting password");
    }
})

// update password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    // get current password and new password from request body
    const { currentPassword, newPassword } = req.body

    // get user id from request
    const userId = req.user?._id
    
    // check if user id is present
    if (!userId) {
        throw new ApiError(401, "Unauthorized request - user id not found");
    }

    // check if current password and new password are present
    if (!currentPassword || !newPassword) {
        throw new ApiError(400, "Current password and new password are required");
    }

    try {
        // find the user with password
        const user = await User.findById(userId).select("+password")
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // check if current password is correct
        const isPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isPasswordCorrect) {
            throw new ApiError(401, "Invalid current password");
        }

        // set new password
        user.password = newPassword;
        await user.save();

        // return response
        return res.status(200).json(
            new ApiResponse(200, null, "Password updated successfully" )
        )
    } catch (error) {
        console.error('Error updating password:', error);
        throw new ApiError(500, "Internal server error while updating password");
    }
})

// get user profile
const getUserProfile = asyncHandler(async (req, res) => {
    // get user id from request
    const userId = req.user?._id

    // check if user id is present
    if (!userId) {
        throw new ApiError(401, "Unauthorized request - user id not found");
    }

    try {
        // find user by id
        const user = await User.findById(userId).select("-password -refreshToken -refreshTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry -passwordResetToken -passwordResetTokenExpiry")
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // remove sensitive data from user object before sending response
        const userResponse = user.toObject();
        user.password = undefined;
        user.refreshToken = undefined;
        user.refreshTokenExpiry = undefined;
        
        // return response
        return res.status(200).json(
            new ApiResponse(200, userResponse, "User profile fetched successfully" )
        )
    } catch (error) {
        console.error('Error getting user profile:', error);
        throw new ApiError(500, "Internal server error while getting user profile");
    }
})

// update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
    // get user id from request
    const userId = req.user?._id

    // check if user id is present
    if (!userId) {
        throw new ApiError(401, "Unauthorized request");
    }

    // get full name from request body
    const { fullName } = req.body
    
    try {
        // find user by id
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // update user full name
        if (fullName) {
            user.fullName = fullName;
        }

        //update user email


        // save user
        await user.save();

        // return response
        return res.status(200).json(
            new ApiResponse(200, user, "User profile updated successfully" )
        )
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw new ApiError(500, "Internal server error while updating user profile");
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    verifyUser,
    resendVerificationEmail,
    refreshAccessToken,
    forgetPassword,
    resetPassword,
    changeCurrentPassword,
    getUserProfile,
    updateUserProfile,
}