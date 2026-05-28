import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken"
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import crypto from "crypto"

const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" })
}

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "60d" })
}

export const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
        throw new ApiError(400, "All fields are required!")
    }

    const [emailExists, usernameExists] = await Promise.all([
        User.findOne({ email }),
        User.findOne({ username })
    ])

    if (emailExists) {
        throw new ApiError(409, "Email already exists")
    }

    if (usernameExists) {
        throw new ApiError(409, "Username already exists")
    }

    const user = await User.create({
        username,
        email,
        password
    });

    const accessToken = generateAccessToken(user._id)
    const refreshToken = generateRefreshToken(user._id)
    
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        accessToken
    })
})

export const loginUser = asyncHandler(async (req, res) => {
    const {email, password} = req.body

    if(!email || !password){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findOne({ email })

    if(!user){
        throw new ApiError(401, "Invalid credentials")
    }

    const isMatch = await user.comparePassword(password)

    if(!isMatch){
        throw new ApiError(401, "Invalid credentials")
    }

    const accessToken = generateAccessToken(user._id)
    const refreshToken = generateRefreshToken(user._id)
    
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 1000
    })

    res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        accessToken
    })
})

export const logoutUser = asyncHandler(async (req, res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        expires: new Date(0)
    })

    res.status(200).json({message: "Logout Successful"})
})

export const getMe = asyncHandler(async (req, res) => {
    res.status(200).json(req.user)
})

export const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken

    if(!token){
        throw new ApiError(401, "No refresh token")
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)

    const user = await User.findById(decoded.id)

    if(!user){
        throw new ApiError(401, "User doesn't exist")
    }

    const newAccessToken = generateAccessToken(user._id)
    const newRefreshToken = generateRefreshToken(user._id)

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict"
    })

    res.json({accessToken: newAccessToken})
})

export const guestLogin = asyncHandler(async (req, res) => {
    const {displayName, guestId} = req.body
    
    if(!displayName || displayName.trim().length < 2){
        throw new ApiError(400, "Display name is required (at least 2 characters long")
    }

    let user;

    if (guestId && guestId.match(/^[0-9a-fA-F]{24}$/)) {
        user = await User.findById(guestId)
    }

    if (!user || !user.isGuest) {
        // generate unique username for guest like John_a3fd4gh to avoid collsions with real usernames
        const uniqueSuffix = crypto.randomBytes(4).toString("hex")
        const safeName = displayName ? displayName.trim().replace(/[^a-zA-Z0-9]/g, '') || 'Guest' : 'Guest'
        const username = `${safeName}_${uniqueSuffix}`

        user = await User.create({
            username,
            isGuest: true,
        })
    } else if (displayName) {
        // Update existing guest's name so they don't remain "guest" forever
        const uniqueSuffix = crypto.randomBytes(4).toString("hex")
        const safeName = displayName.trim().replace(/[^a-zA-Z0-9]/g, '') || 'Guest'
        user.username = `${safeName}_${uniqueSuffix}`
        await user.save()
    }

    const accessToken = generateAccessToken(user._id)
    const refreshToken = generateRefreshToken(user._id)

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.status(201).json({
        _id: user._id,
        username: displayName.trim(),
        isGuest: true,
        accessToken
    })
})

export const upgradeGuest = asyncHandler(async (req, res) => {
    const {email, password, username} = req.body

    if(!req.user.isGuest){
        throw new ApiError(400, "You already are a registered user")
    }

    if(!email || !password){
        throw new ApiError(400, "Email and password are required to register")
    }

    const emailExists = await User.findOne({email})
    if(emailExists){
        throw new ApiError(409, "Email already in use")
    }

    if (username) {
        const trimmedUsername = username.trim()
        if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
            throw new ApiError(400, "Username must be between 3 and 20 characters")
        }
        const usernameExists = await User.findOne({ username: trimmedUsername })
        if (usernameExists && usernameExists._id.toString() !== req.user._id.toString()) {
            throw new ApiError(409, "Username already in use")
        }
        req.user.username = trimmedUsername
    }

    req.user.email = email
    req.user.password = password
    req.user.isGuest = false

    await req.user.save()

    const accessToken = generateAccessToken(req.user._id)
    const refreshToken = generateRefreshToken(req.user._id)

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.json({
        message: "Account registered successfully",
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isGuest: false,
        accessToken
    })
})