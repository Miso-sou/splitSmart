import mongoose from "mongoose"
import Expense from "../models/expense.model.js"
import Group from "../models/group.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import ApiError from "../utils/ApiError.js"

const splitEqually = (totalAmount, participants) => {
    if (participants.length === 0) return [];
    const perPerson = Math.round((totalAmount / participants.length) * 100) / 100;
    const splits = participants.map(userId => ({
        user: userId,
        amount: perPerson
    }));
    
    // Adjust for division rounding difference
    const roundedSum = perPerson * participants.length;
    const diff = Math.round((totalAmount - roundedSum) * 100) / 100;
    if (diff !== 0 && splits.length > 0) {
        splits[0].amount = Math.round((splits[0].amount + diff) * 100) / 100;
    }
    return splits;
};

export const createExpense = asyncHandler(async (req, res) => {
    const { group, description, icon, category, paidBy, items, splitType, splitAmong, customSplits } = req.body

    if (!group || !description || !paidBy) {
        throw new ApiError(400, "Group, description and paidBy are required")
    }

    const groupDoc = await Group.findById(group)
    if (!groupDoc) {
        throw new ApiError(404, "Group not found")
    }

    const isMember = groupDoc.members.some(m => m.user.toString() === req.user._id.toString())
    if (!isMember) {
        throw new ApiError(403, "You are not part of this group")
    }

    // --- Calculating totalamount from items ---
    // If items are provided, sum their prices. Otherwise, require totalAmount in body

    let totalAmount = 0
    if (items && items.length > 0) {
        totalAmount = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) // price * quantity per item, defaults to 1 if no quantity given
    } else {
        throw new ApiError(400, "Atleast one item is required")
    }

    // --- Building splits array according to type of split ---
    let splits = []
    switch (splitType) {
        case "equal":
            if (!splitAmong || splitAmong.length === 0) {
                throw new ApiError(400, "splitAmong is required for equal splitting")
            }

            // Auto-include the creator in the split list if not already present
            const creatorId = req.user._id.toString()
            if (!splitAmong.includes(creatorId)) {
                splitAmong.push(creatorId)
            }

            splits = splitEqually(totalAmount, splitAmong);
            break;

        case "custom":
            if (!customSplits || customSplits.length === 0) {
                throw new ApiError(400, "customSplit is required for custom split")
            }

            // Validate that custom splits amount to total
            const customTotal = customSplits.reduce((sum, s) => sum + s.amount, 0)
            if (Math.abs(customTotal - totalAmount) > 0.015) {
                throw new ApiError(400, `Custom splits (${customTotal}) must equal to total (${totalAmount})`)
            }
            splits = customSplits.map(s => ({
                user: s.user,
                amount: s.amount
            }))

            // Adjust first custom split for minor rounding tolerances (e.g., 0.01 difference)
            const customDiff = Math.round((totalAmount - customTotal) * 100) / 100;
            if (customDiff !== 0 && splits.length > 0) {
                splits[0].amount = Math.round((splits[0].amount + customDiff) * 100) / 100;
            }

            break;

        case "item-based":
            // for item-based another controller will handle it with sockets, so leaving splits empty here. (item-based is the feature where users select what they have to pay for by selecting items in the group chat.)
            splits = []

            break;

        default:
            throw new ApiError(400, "splitType must be 'equal', 'custom' or 'item-based'")
    }

    // if guest then approval needed first
    const approvalStatus = req.user.isGuest ? "pending" : "approved"

    // finally creating the expense
    const expense = await Expense.create({
        group,
        description,
        icon: icon || "",
        totalAmount,
        paidBy,
        splits,
        approvalStatus,
        items: items || [],
        category: category || "other",
        createdBy: req.user._id
    })

    res.status(201).json(expense)
})

export const getGroupExpenses = asyncHandler(async (req, res) => {
    const { groupId } = req.params

    const group = await Group.findById(groupId)
    if (!group) {
        throw new ApiError(404, "Group not found")
    }

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString())
    if (!isMember) {
        throw new ApiError(403, "You are not a member of this group")
    }

    const expenses = await Expense.find({ group: groupId })
        .populate("paidBy", "username avatar isGuest")
        .populate("splits.user", "username avatar isGuest")
        .populate("createdBy", "username avatar isGuest")
        .sort({ createdAt: -1 }) // newsest first

    if (expenses.length === 0) {
        return res.json({ message: "No expenses in this group yet", expenses: [] })
    }

    res.json(expenses)
})

export const approveExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id) // .id not ._id — Express params use the name from the route pattern /:id

    if (!expense) {
        throw new ApiError(404, "Expense not found")
    }

    //Verify the user is an admin of the expense's group
    const group = await Group.findById(expense.group)
    if (!group) {
        throw new ApiError(404, "Group not found")
    }

    const member = group.members.find(m => m.user.toString() === req.user._id.toString()) // .members not .member
    if (!member || member.role !== "admin") {
        throw new ApiError(403, "Only group admins can approve an expense")
    }

    // Only pending expenses can be approved
    if (expense.approvalStatus === "approved") { // === comparison, not = assignment
        throw new ApiError(400, "Expense is already approved")
    }

    expense.approvalStatus = "approved"
    await expense.save()

    res.json({ message: "Expense Approved", expense })
})

export const updateExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id)

    if (!expense) {
        throw new ApiError(404, "Expense not found")
    }

    // Guests cannot edit expenses — frontend should redirect to login/upgrade page
    if (req.user.isGuest) {
        throw new ApiError(403, "Guest users cannot edit expenses. Please register to edit.")
    }

    // Only the creator or group admin can edit
    const isCreator = expense.createdBy.toString() === req.user._id.toString()
    const group = await Group.findById(expense.group)
    const member = group?.members.find(
        m => m.user.toString() === req.user._id.toString()
    )
    const isAdmin = member?.role === "admin"

    if (!isCreator && !isAdmin) {
        throw new ApiError(403, "Only the expense creator or an admin can edit this expense")
    }

    // --- Extract editable fields from request body ---
    // createdBy and group are NEVER editable
    const { description, icon, category, paidBy, items, splitType, splitAmong, customSplits } = req.body

    // Update simple metadata fields if provided
    if (description) expense.description = description
    if (icon !== undefined) expense.icon = icon
    if (category) expense.category = category
    if (paidBy) expense.paidBy = paidBy

    // If items are being updated, recalculate totalAmount
    if (items && items.length > 0) {
        expense.items = items
        expense.totalAmount = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
    }

    // If splitType is provided, recalculate splits with updated totalAmount
    if (splitType) {
        let splits = []

        switch (splitType) {
            case "equal":
                if (!splitAmong || splitAmong.length === 0) {
                    throw new ApiError(400, "splitAmong is required for equal splitting")
                }

                // Auto-include the creator
                const creatorId = req.user._id.toString()
                if (!splitAmong.includes(creatorId)) {
                    splitAmong.push(creatorId)
                }

                splits = splitEqually(expense.totalAmount, splitAmong);
                break;

            case "custom":
                if (!customSplits || customSplits.length === 0) {
                    throw new ApiError(400, "customSplits is required for custom split")
                }
                const customTotal = customSplits.reduce((sum, s) => sum + s.amount, 0)
                if (Math.abs(customTotal - expense.totalAmount) > 0.015) {
                    throw new ApiError(400, `Custom splits (${customTotal}) must equal total (${expense.totalAmount})`)
                }
                splits = customSplits.map(s => ({
                    user: s.user,
                    amount: s.amount
                }))

                // Adjust first custom split for minor rounding tolerances (e.g., 0.01 difference)
                const customDiff = Math.round((expense.totalAmount - customTotal) * 100) / 100;
                if (customDiff !== 0 && splits.length > 0) {
                    splits[0].amount = Math.round((splits[0].amount + customDiff) * 100) / 100;
                }
                break;

            case "item-based":
                // Recalculate splits based on current items claims, rather than clearing them
                splits = calculateSplits(expense.items);
                break;

            default:
                throw new ApiError(400, "splitType must be 'equal', 'custom' or 'item-based'")
        }

        expense.splits = splits
    }

    await expense.save()

    res.json({ message: "Expense updated", expense })
})

export const deleteExpense = asyncHandler(async (req, res) => {
    const expenseId = req.params.id
    const expense = await Expense.findById(expenseId)

    if (!expense) {
        throw new ApiError(404, "Expense not found")
    }

    // check if the user is creator
    const isCreator = expense.createdBy.toString() === req.user._id.toString()

    const group = await Group.findById(expense.group)
    const member = group?.members.find(
        m => m.user.toString() === req.user._id.toString()
    )

    const isAdmin = member?.role === "admin"

    if (!isCreator && !isAdmin) {
        throw new ApiError(403, "Only admin or creator of the expense can delete this expense")
    }

    await expense.deleteOne()

    res.json({ message: "Expense deleted succesffully" })
})

export const getgroupBalances = asyncHandler(async (req, res) => {
    const { groupId } = req.params

    const group = await Group.findById(groupId).populate("members.user", "username avatar") // Populate is esssentially a join for nonSQL DBs. It helps queries referenced schema inside a specified schema, essentially skipping one manual query.

    if (!group) {
        throw new ApiError(404, "Group not found")
    }

    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString())

    if (!isMember) {
        throw new ApiError(403, "You are not a member of this group")
    }

    // Only approved expenses are counted
    const expenses = await Expense.find({
        group: groupId,
        approvalStatus: "approved"
    })

    const balances = {}

    // Intialize all members with 0 balance
    group.members.forEach(m => {
        balances[m.user._id.toString()] = {
            user: m.user,
            physicalPaid: 0,
            totalPaid: 0,
            totalOwed: 0,
        }
    })

    expenses.forEach(expense => {
        const payerId = expense.paidBy.toString()

        if (balances[payerId]) {
            balances[payerId].physicalPaid += expense.totalAmount
        }

        const payerSplit = expense.splits.find(s => s.user.toString() === payerId)
        const payerShare = payerSplit ? payerSplit.amount : 0

        if (balances[payerId]) {
            balances[payerId].totalPaid += payerShare
        }

        // Each person in splits gets debited their share
        expense.splits.forEach(split => {
            const userId = split.user.toString()
            if (balances[userId]) {
                balances[userId].totalOwed += split.amount
            }
        })
    })

    // Calculate net balance for each member 
    const result = Object.values(balances).map(b => {
        const net = Math.round((b.physicalPaid - b.totalOwed) * 100) / 100;
        return {
            user: b.user,
            totalPaid: Math.round(b.totalPaid * 100) / 100,
            totalOwed: Math.round(b.totalOwed * 100) / 100,
            netBalance: Math.abs(net) < 0.02 ? 0 : net
        }
    })

    // Also calculate group total spenditure
    const totalGroupSpendings = expenses.reduce((sum, e) => sum + e.totalAmount, 0)

    res.json({
        groupId,
        totalGroupSpendings: Math.round(totalGroupSpendings * 100) / 100,
        balances: result
    })

})

export const getExpenseById = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id)
        .populate("paidBy", "username avatar isGuest")
        .populate("splits.user", "username avatar isGuest")
        .populate("items.claims.user", "username avatar isGuest")
        .populate("createdBy", "username avatar isGuest");

    if (!expense) {
        throw new ApiError(404, "Expense not found");
    }

    const group = await Group.findById(expense.group);
    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) {
        throw new ApiError(403, "You are not a member of this group");
    }

    res.json(expense);
});

// Synchronous helper to calculate splits from items array
const calculateSplits = (items) => {
    const TAX_KEYWORDS = ['tax', 'gst', 'vat', 'service charge', 'cess'];
    const isTaxItem = (name) => TAX_KEYWORDS.some(k => name.toLowerCase().includes(k));

    let totalTaxAmount = 0;
    let totalClaimedNonTax = 0;
    const userSplitTotals = {};
    const participants = new Set();

    items.forEach(i => {
        if (isTaxItem(i.name)) {
            totalTaxAmount += (i.price * (i.quantity || 1));
        } else {
            const qty = i.quantity || 1;
            const claimersCount = i.claims.length;
            
            if (claimersCount > 0) {
                if (qty === 1) {
                    // Hybrid Case 1: Quantity is 1 -> Split equally among all claimers
                    const totalItemCost = i.price;
                    totalClaimedNonTax += totalItemCost;
                    const costPerClaimer = totalItemCost / claimersCount;
                    
                    i.claims.forEach(c => {
                        const uid = c.user.toString();
                        if (!userSplitTotals[uid]) userSplitTotals[uid] = 0;
                        userSplitTotals[uid] += costPerClaimer;
                        participants.add(uid);
                    });
                } else {
                    // Hybrid Case 2: Quantity > 1 -> Portion-based pricing (price * claimed quantity)
                    i.claims.forEach(c => {
                        const uid = c.user.toString();
                        if (!userSplitTotals[uid]) userSplitTotals[uid] = 0;
                        userSplitTotals[uid] += (i.price * c.quantity);
                        totalClaimedNonTax += (i.price * c.quantity);
                        participants.add(uid);
                    });
                }
            }
        }
    });

    const participantCount = participants.size;
    const taxPerPerson = participantCount > 0 ? (totalTaxAmount / participantCount) : 0;

    const splits = Object.keys(userSplitTotals).map(userId => ({
        user: new mongoose.Types.ObjectId(userId), // Cast as ObjectId so Mongoose populates correctly
        amount: Math.round((userSplitTotals[userId] + taxPerPerson) * 100) / 100
    }));

    // Adjust for division rounding difference to ensure sum of splits is exact down to the last penny
    const totalClaimedAndTax = totalClaimedNonTax + totalTaxAmount;
    const currentSplitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
    const diff = Math.round((totalClaimedAndTax - currentSplitsSum) * 100) / 100;
    
    if (diff !== 0 && splits.length > 0) {
        splits[0].amount = Math.round((splits[0].amount + diff) * 100) / 100;
    }

    return splits;
};

// Rewrite claimItem with OCC and Jitter
export const claimItem = asyncHandler(async (req, res) => {
    const { id: expenseId, itemId } = req.params;
    const requestedQuantity = parseInt(req.body.quantity) || 1;

    if (requestedQuantity <= 0) {
        throw new ApiError(400, "Quantity must be at least 1");
    }

    let retries = 3;
    while (retries > 0) {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            throw new ApiError(404, "Expense not found");
        }

        const group = await Group.findById(expense.group);
        const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            throw new ApiError(403, "You are not a member of this group");
        }

        const item = expense.items.find(i => i._id.toString() === itemId);
        if (!item) {
            throw new ApiError(404, "Item not found");
        }

        const myClaimIndex = item.claims.findIndex(c => c.user.toString() === req.user._id.toString());
        
        if (item.quantity === 1) {
            // Case 1: Quantity is 1 -> Toggle claiming, ignore requested quantity body, default to 1
            if (myClaimIndex === -1) {
                item.claims.push({
                    user: req.user._id,
                    quantity: 1
                });
            }
        } else {
            // Case 2: Quantity > 1 -> Portion-based claiming, validate remaining quantity
            const otherClaimsQty = item.claims
                .filter(c => c.user.toString() !== req.user._id.toString())
                .reduce((sum, c) => sum + c.quantity, 0);

            const remainingQty = item.quantity - otherClaimsQty;

            if (requestedQuantity > remainingQty) {
                throw new ApiError(400, `Cannot claim more than remaining quantity (${remainingQty})`);
            }

            if (myClaimIndex >= 0) {
                item.claims[myClaimIndex].quantity = requestedQuantity;
            } else {
                item.claims.push({
                    user: req.user._id,
                    quantity: requestedQuantity
                });
            }
        }

        const newSplits = calculateSplits(expense.items);
        const currentVersion = expense.__v || 0;

        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: expenseId, __v: currentVersion },
            {
                $set: {
                    items: expense.items,
                    splits: newSplits
                },
                $inc: { __v: 1 }
            },
            { new: true }
        );

        if (updatedExpense) {
            const finalExpense = await Expense.findById(expenseId)
                .populate("paidBy", "username avatar isGuest")
                .populate("splits.user", "username avatar isGuest")
                .populate("items.claims.user", "username avatar isGuest")
                .populate("createdBy", "username avatar isGuest");
            return res.json(finalExpense);
        }

        // Concurrency backoff jitter
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        retries--;
    }

    throw new ApiError(409, "Conflict: The expense was updated by another user. Please try again.");
});

// Add unclaimItem with OCC and Jitter
export const unclaimItem = asyncHandler(async (req, res) => {
    const { id: expenseId, itemId } = req.params;

    let retries = 3;
    while (retries > 0) {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            throw new ApiError(404, "Expense not found");
        }

        const group = await Group.findById(expense.group);
        const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            throw new ApiError(403, "You are not a member of this group");
        }

        const item = expense.items.find(i => i._id.toString() === itemId);
        if (!item) {
            throw new ApiError(404, "Item not found");
        }

        item.claims = item.claims.filter(c => c.user.toString() !== req.user._id.toString());

        const newSplits = calculateSplits(expense.items);
        const currentVersion = expense.__v || 0;

        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: expenseId, __v: currentVersion },
            {
                $set: {
                    items: expense.items,
                    splits: newSplits
                },
                $inc: { __v: 1 }
            },
            { new: true }
        );

        if (updatedExpense) {
            const finalExpense = await Expense.findById(expenseId)
                .populate("paidBy", "username avatar isGuest")
                .populate("splits.user", "username avatar isGuest")
                .populate("items.claims.user", "username avatar isGuest")
                .populate("createdBy", "username avatar isGuest");
            return res.json(finalExpense);
        }

        // Concurrency backoff jitter
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        retries--;
    }

    throw new ApiError(409, "Conflict: The expense was updated. Please try again.");
});