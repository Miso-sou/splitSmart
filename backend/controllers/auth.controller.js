import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs"
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

