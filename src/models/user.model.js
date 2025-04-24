
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({
    path: "./.env"
});
import crypto from "crypto";
import { AvailableUserRoles, UserRolesEnum } from "../utils/constants.js";

const userSchema = new mongoose.Schema({
    avatar: {
        type: {
            url: String,
            localpath: String
        },
        default: {
            url: `https://placeholder.co/600x400`,
            localpath: ""
        }
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    forgotPasswordToken: {
        type: String,
    },
    forgotPasswordTokenExpiry: {
        type: Date,
    },
    // resetPasswordToken: {
    //     type: String,
    // },
    // resetPasswordTokenExpiry: {
    //     type: Date,
    // },
    refreshToken: {
        type: String,
    },
    refreshTokenExpiry: {
        type: Date,
    },
    emailVerificationToken: {
        type: String,
    },
    emailVerificationTokenExpiry: {
        type: Date,
    },
    role: {
        type: String,
        enum: AvailableUserRoles,
        default: UserRolesEnum.MEMBER,
        required: true
    }
}, { timestamps: true });

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = async function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username,
            email: this.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    )
};

userSchema.methods.generateRefreshToken = async function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    )
};

userSchema.methods.generateTemporaryToken = async function () {
    const unHashedToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(unHashedToken).digest("hex");
    const tokenExpiry = Date.now() + 30 * 60 * 1000;

    return { hashedToken, unHashedToken, tokenExpiry };
}

export const User = mongoose.model("User", userSchema);