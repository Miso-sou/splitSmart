import mongoose, { Schema } from "mongoose";

const memberSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'member'], // whitelist role to either of these two
        default: 'member'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, {_id: false});

const groupSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true, // remove all trailing and leading whitespaces.
        maxLength: 100
    },
    description: {
        type: String,
        default: '',
        maxLength: 300
    },
    members: [memberSchema],
    inviteToken: {
        type: String,
        unique: true,
        sparse: true
    },
    inviteTokenExpiry: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
})

const Group = mongoose.model('Group', groupSchema)
export default Group