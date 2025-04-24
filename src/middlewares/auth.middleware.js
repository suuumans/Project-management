

import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import dotenv from "dotenv";
dotenv.config();

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        // 1. Get token from cookies (or header as fallback if needed)
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request: No token provided");
        }

        // 2. Verify the token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        // Note: jwt.verify throws an error if token is invalid or expired

        // 3. Find the user based on decoded token's ID
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry -passwordResetToken -passwordResetTokenExpiry" // Exclude sensitive fields
        );

        if (!user) {
            // This case might happen if the user was deleted after the token was issued
            throw new ApiError(401, "Invalid Access Token: User not found");
        }

        // 4. Attach user to the request object
        req.user = user;
        next(); // Proceed to the next middleware or route handler

    } catch (error) {
        // Handle specific JWT errors or general errors
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
             throw new ApiError(401, error?.message || "Invalid Access Token");
        }
        // Rethrow other potential errors (like database errors) handled by asyncHandler
        throw error;
    }
});
