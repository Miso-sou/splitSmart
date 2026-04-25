import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"
import ApiError from "../utils/ApiError.js"
import asyncHandler from "../utils/asyncHandler.js"

export const protect = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization

    if(!authHeader || !authHeader.startsWith("Bearer ")){
        throw new ApiError(401, "No token provided")
    }

    const token = authHeader.split(" ")[1] // create an array of header and put the token in the first index.

    const decoded = jwt.verify(token, process.env.JWT_SECRET) // returns an object with id, iat and expiry.

    const user = await User.findById(decoded.id).select("-password")

    if(!user){
        throw new ApiError(401, "User not found")
    }

    req.user = user

    next();
})