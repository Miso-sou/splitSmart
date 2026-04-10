import { User } from "../models/User.model";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const generateToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn: "10d"})
}

const registerUser = async (req, res) => {
    
}