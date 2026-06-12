import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"
import ApiError from "../utils/ApiError.js"
import asyncHandler from "../utils/asyncHandler.js"
import Group from "../models/group.model.js"

// Lightweight in-memory user cache (TTL: 60 seconds)
// Eliminates a full DB round-trip on every authenticated request.
const USER_CACHE_TTL_MS = 60_000
const userCache = new Map()

function getCachedUser(id) {
    const entry = userCache.get(id)
    if (!entry) return null
    if (Date.now() - entry.ts > USER_CACHE_TTL_MS) {
        userCache.delete(id)
        return null
    }
    return entry.user
}

function setCachedUser(id, user) {
    userCache.set(id, { user, ts: Date.now() })
}

/** Call this when a user's profile is updated to keep the cache fresh. */
export function invalidateUserCache(id) {
    userCache.delete(id)
}

export const protect = asyncHandler(async (req, res, next) => {
    const startTime = performance.now()
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        const totalTime = (performance.now() - startTime).toFixed(3)
        console.log(`[authMiddleware] Total: ${totalTime}ms (No token provided)`)
        throw new ApiError(401, "No token provided")
    }

    const token = authHeader.split(" ")[1]

    try {
        const jwtStart = performance.now()
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const jwtEnd = performance.now()

        const dbStart = performance.now()
        let user = getCachedUser(decoded.id)
        const cacheHit = !!user

        if (!user) {
            user = await User.findById(decoded.id).select("-password").lean()
            if (user) setCachedUser(decoded.id, user)
        }
        const dbEnd = performance.now()

        if (!user) {
            const totalTime = (performance.now() - startTime).toFixed(3)
            console.log(`[authMiddleware] Total: ${totalTime}ms (User not found)`)
            throw new ApiError(401, "User not found")
        }

        req.user = user

        const totalTime = (performance.now() - startTime).toFixed(3)
        const jwtTime = (jwtEnd - jwtStart).toFixed(3)
        const dbTime = (dbEnd - dbStart).toFixed(3)
        console.log(`[authMiddleware] Total: ${totalTime}ms | JWT Verify: ${jwtTime}ms | DB Lookup: ${dbTime}ms${cacheHit ? ' (CACHED)' : ''}`)

        next();
    } catch (error) {
        const totalTime = (performance.now() - startTime).toFixed(3)
        console.log(`[authMiddleware] Total (Error): ${totalTime}ms | Error: ${error.message}`)
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Token expired")
        }
        throw new ApiError(401, "Not authorized, token failed")
    }
})

export const requireAdmin = asyncHandler(async (req, res, next) => {
    const group = await Group.findById(req.params.id)

    if (!group) {
        throw new ApiError(404, "Group not found")
    }

    const member = group.members.find(m => m.user.toString() === req.user._id.toString())

    if (!member || member.role !== "admin") {
        throw new ApiError(403, "Only group admins can perform this function.")
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