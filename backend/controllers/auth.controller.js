import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken"
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" })
}

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" })
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