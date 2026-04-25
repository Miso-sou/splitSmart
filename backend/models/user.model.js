import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true, // removes whitespaces from the string.
      minLength: 3,
      maxLength: 20,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minLength: 8,
      maxLength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email format is wrong"], // check for valid email
    },
    avatar: {
      type: String,
      default: ''
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  }

);


// Hash password before saving — only if the password field was modified
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPass) {
  return await bcrypt.compare(enteredPass, this.password)
}

export const User = mongoose.model("User", userSchema);