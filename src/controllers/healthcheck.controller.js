
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";

export const healthCheck = async (req, res) => {
    try {
        return res.status(200).json(
            new ApiResponse(200, { message: "Server is up and running"})
        )
    } catch (error) {
        throw new ApiError(500, "Server error occured while checking health check", error)
    }
}