import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"
import ApiError from "../utils/ApiError.js"
import asyncHandler from "../utils/asyncHandler.js"
import Group from "../models/group.model.js"

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

export const requireAdmin = asyncHandler(async (req, res, next) => {
    const group = await Group.findById(req.params.id)

    if(!group){
        throw new ApiError(404, "Group not found")
    }

    const member = group.members.find(m => m.user.toString() === req.user._id.toString())

    if(!member || member.role !== "admin"){
        throw new ApiError (403, "Only group admins can perform this function.")
    }

    req.group = group
    next();
})

export const requireRegistered = asyncHandler(async (req, res, next) => {
  if (req.user.isGuest) {
    throw new ApiError(403, "This action requires a registered account.");
  }
  next();
});