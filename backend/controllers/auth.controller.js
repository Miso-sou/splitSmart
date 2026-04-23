import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken"

const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" })
}

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" })
}

export const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body

        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required!" })
        }
    
        const [emailExists, usernameExists] = await Promise.all([
            User.findOne({ email }),
            User.findOne({ username })
        ])
    
        if (emailExists) {
            return res.status(409).json({ message: "Email already exists" })
        }
    
        if (usernameExists) {
            return res.status(409).json({ message: "Username already exists" })
        }
    
        const user = await User.create({
            username,
            email,
            password
        });

        const accessToken = generateAccessToken(user._id)
        const refreshToken = generateRefreshToken(user._id)
        
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true, // JavaScript can't access this cookie.
            secure: process.env.NODE_ENV === "production", // cookie is sent only over HTTPS.
            sameSite: "strict", // Cookie won't be sent on cross-site requests
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        })
    
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            accessToken
        })
        
    } catch (error) {
        res.status(500).json({
            message: error.message,
        })
    }
}

export const loginUser = async (req, res) => {
    try {
        const {email, password} = req.body
        if(!email || !password){
            return res.status(400).json({ message: "All fields are required"})
        }

        const user = await User.findOne({ email })

        if(!user){
            return res.status(401).json({message: "Invalid credentials"})
        }

        const isMatch = await user.comparePassword(password)

        if(!isMatch){
            return res.status(401).json({message: "Invalid credentials"})
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
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
} 

export const logoutUser = async (req, res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        expires: new Date(0)
    })

    res.status(200).json({message: "Logout Successful"})
}

export const getMe = async (req, res) => {
    res.status(200).json(req.user)
}

export const refreshToken = async (req, res) => {
    try {
        const token = req.cookie.refreshToken

    if(!token){
        return res.status(401).json({message: "No refresh token"})
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)

    const user = await User.findById(decoded.id)

    if(!user){
        return res.status(401).json({message: "User doesn't exist"})
    }

    const newAccessToken = generateAccessToken(user._id)
    const newRefreshToken = generateRefreshToken(user._id)

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict"
    })

    res.json({accessToken: newAccessToken})

    } catch (error) {
        return res.status(401).json({message: "Invalid refresh token"})    
    }
   
}