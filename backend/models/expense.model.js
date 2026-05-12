import mongoose from "mongoose";

const expenseSchema = new Schema({
    Group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    description: {
        type: String,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    splits: [{
        user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        amount: {type: Number, required: true},
        settled: {type: Boolean, default: false}
    }],
    approvalStatus: {
        type: String,
        enum: ['approved', 'pending'],
        default: 'approved'
    },
    billImageUrl: {type: String, default: ''},
    parsedItems: [{
        name: String,
        price: Number,
        assignedTo: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null}
    }],
    category: {
        type: String,
        enum: ['food', 'travel', 'accomodation', 'entertainment', 'utilities', 'other'],
        default: 'other'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
    }
}, {timestamps: true});