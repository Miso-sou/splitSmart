import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"

export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization

    if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({message: "No token provided"})
    }

    const token = authHeader.split(" ")[1] // create an array of header and put the token in the first index.

    const decoded = jwt.verify(token, process.env.JWT_SECRET) // returns an object with id, iat and expiry.

    const user = await User.findById(decoded.id).select("-password")

    if(!user){
        return res.status(401).json({message: "User not found"})
    }

    req.user = user

    next();

    } catch (error) {
        return res.status(401).json({message: "Not authorized, token failed."})
    }
}