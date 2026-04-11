import { User } from "../models/User.model";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "10d" })
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
    
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
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

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
} 

