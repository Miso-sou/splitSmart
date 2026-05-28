import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// PUT /api/user/profile
export const updateProfile = asyncHandler(async (req, res) => {
    const { username, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (username && username.trim() !== user.username) {
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
            throw new ApiError(400, "Username must be between 3 and 20 characters");
        }

        const usernameExists = await User.findOne({ username: trimmedUsername });
        if (usernameExists) {
            throw new ApiError(409, "Username already exists");
        }

        user.username = trimmedUsername;
    }

    if (avatar !== undefined) {
        user.avatar = avatar;
    }

    await user.save();

    res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isGuest: user.isGuest,
        message: "Profile updated successfully"
    });
});

// PUT /api/user/reset-password
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 8 || newPassword.trim().length > 30) {
        throw new ApiError(400, "New password must be between 8 and 30 characters");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isGuest) {
        throw new ApiError(400, "Guest accounts do not have passwords. Please register/upgrade your account instead.");
    }

    if (!currentPassword) {
        throw new ApiError(400, "Current password is required");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new ApiError(401, "Incorrect current password");
    }

    user.password = newPassword.trim();
    await user.save();

    res.status(200).json({
        message: "Password changed successfully"
    });
});
