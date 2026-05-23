import Expense from "../models/expense.model.js"
import Group from "../models/group.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import ApiError from "../utils/ApiError.js"

export const createExpense = asyncHandler(async (req, res) => {
    const {group, description, icon, category, paidBy, items, splitType, splitAmong, customSplits} = req.body

    if(!group || !description || !paidBy){
        throw new ApiError(400, "Group, description and paidBy are required")
    }

    const groupDoc = await Group.findById(group)
    if(!groupDoc){
        throw new ApiError(404, "Group not found")
    }

    const isMember = groupDoc.members.some(m => m.user.toString() === req.user._id.toString())
    if(!isMember){
        throw new ApiError(403, "You are not part of this group")
    }

    // --- Calculating totalamount from items ---
    // If items are provided, sum their prices. Otherwise, require totalAmount in body

    let totalAmount = 0
    if(items && items.length > 0){
        totalAmount = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) // price * quantity per item, defaults to 1 if no quantity given
    } else {
        throw new ApiError(400, "Atleast one item is required")
    }

    // --- Building splits array according to type of split ---
    let splits = []
    switch(splitType){
        case "equal":
            if(!splitAmong || splitAmong.length === 0){
                throw new ApiError(400, "splitAmong is required for equal splitting")
            }

            // Auto-include the creator in the split list if not already present
            const creatorId = req.user._id.toString()
            if(!splitAmong.includes(creatorId)){
                splitAmong.push(creatorId)
            }
            
            const perPerson = Math.round((totalAmount / splitAmong.length) * 100) / 100
            splits = splitAmong.map(userId => ({
                user: userId,
                amount: perPerson
            }))

            break;
        
        case "custom":
            if(!customSplits || customSplits.length === 0){
                throw new ApiError(400, "customSplit is required for custom split")
            }

            // Validate that custom splits amount to total
            const customTotal = customSplits.reduce((sum, s) => sum + s.amount, 0)
            if(Math.abs(customTotal - totalAmount) > 0.01){
                throw new ApiError(400, `Custom splits (${customTotal}) must equal to total (${totalAmount})`)
            }
            splits = customSplits.map(s => ({
                user: s.user,
                amount: s.amount
            }))

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
    const {groupId} = req.params

    const group = await Group.findById(groupId)
    if(!group){
        throw new ApiError(404, "Group not found")
    }

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString())
    if(!isMember){
        throw new ApiError(403, "You are not a member of this group")
    }

    const expenses = await Expense.find({group: groupId})
        .populate("paidBy", "username avatar isGuest")
        .populate("splits.user", "username avatar isGuest")
        .populate("createdBy", "username avatar isGuest")
        .sort({createdAt: -1}) // newsest first
    
    if(expenses.length === 0){
        return res.json({ message: "No expenses in this group yet", expenses: [] })
    }

    res.json(expenses)
})

export const approveExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id) // .id not ._id — Express params use the name from the route pattern /:id

    if(!expense){
        throw new ApiError(404, "Expense not found")
    }

    //Verify the user is an admin of the expense's group
    const group = await Group.findById(expense.group)
    if(!group){
        throw new ApiError(404, "Group not found")
    }

    const member = group.members.find(m => m.user.toString() === req.user._id.toString()) // .members not .member
    if(!member || member.role !== "admin"){
        throw new ApiError(403, "Only group admins can approve an expense")
    }

    // Only pending expenses can be approved
    if(expense.approvalStatus === "approved"){ // === comparison, not = assignment
        throw new ApiError(400, "Expense is already approved")
    } 

    expense.approvalStatus = "approved"
    await expense.save()

    res.json({message: "Expense Approved", expense})
})

export const updateExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id)

    if(!expense){
        throw new ApiError(404, "Expense not found")
    }

    // Guests cannot edit expenses — frontend should redirect to login/upgrade page
    if(req.user.isGuest){
        throw new ApiError(403, "Guest users cannot edit expenses. Please register to edit.")
    }

    // Only the creator or group admin can edit
    const isCreator = expense.createdBy.toString() === req.user._id.toString()
    const group = await Group.findById(expense.group)
    const member = group?.members.find(
        m => m.user.toString() === req.user._id.toString()
    )
    const isAdmin = member?.role === "admin"

    if(!isCreator && !isAdmin){
        throw new ApiError(403, "Only the expense creator or an admin can edit this expense")
    }

    // --- Extract editable fields from request body ---
    // createdBy and group are NEVER editable
    const {description, icon, category, paidBy, items, splitType, splitAmong, customSplits} = req.body

    // Update simple metadata fields if provided
    if(description) expense.description = description
    if(icon !== undefined) expense.icon = icon
    if(category) expense.category = category
    if(paidBy) expense.paidBy = paidBy

    // If items are being updated, recalculate totalAmount
    if(items && items.length > 0){
        expense.items = items
        expense.totalAmount = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
    }

    // If splitType is provided, recalculate splits with updated totalAmount
    if(splitType){
        let splits = []

        switch(splitType){
            case "equal":
                if(!splitAmong || splitAmong.length === 0){
                    throw new ApiError(400, "splitAmong is required for equal splitting")
                }

                // Auto-include the creator
                const creatorId = req.user._id.toString()
                if(!splitAmong.includes(creatorId)){
                    splitAmong.push(creatorId)
                }

                const perPerson = Math.round((expense.totalAmount / splitAmong.length) * 100) / 100
                splits = splitAmong.map(userId => ({
                    user: userId,
                    amount: perPerson
                }))
                break;

            case "custom":
                if(!customSplits || customSplits.length === 0){
                    throw new ApiError(400, "customSplits is required for custom split")
                }
                const customTotal = customSplits.reduce((sum, s) => sum + s.amount, 0)
                if(Math.abs(customTotal - expense.totalAmount) > 0.01){
                    throw new ApiError(400, `Custom splits (${customTotal}) must equal total (${expense.totalAmount})`)
                }
                splits = customSplits.map(s => ({
                    user: s.user,
                    amount: s.amount
                }))
                break;

            case "item-based":
                splits = [] // will be populated via Socket.io claiming
                break;

            default:
                throw new ApiError(400, "splitType must be 'equal', 'custom' or 'item-based'")
        }

        expense.splits = splits
    }

    await expense.save()

    res.json({message: "Expense updated", expense})
})

export const deleteExpense = asyncHandler(async (req, res) => {
    const expenseId = req.params.id
    const expense = await Expense.findById(expenseId)

    if(!expense){
        throw new ApiError(404, "Expense not found")
    }

    // check if the user is creator
    const isCreator = expense.createdBy.toString() === req.user._id.toString()

    const group = await Group.findById(expense.group)
    const member = group?.members.find(
        m => m.user.toString() === req.user._id.toString()
    )

    const isAdmin = member?.role === "admin"

    if(!isCreator && !isAdmin){
        throw new ApiError(403, "Only admin or creator of the expense can delete this expense")
    }

    await expense.deleteOne()

    res.json({ message: "Expense deleted succesffully"})
})

export const getgroupBalances = asyncHandler(async (req, res) => {
    const{groupId} = req.params

    const group = await Group.findById(groupId).populate("members.user", "username avatar") // Populate is esssentially a join for nonSQL DBs. It helps queries referenced schema inside a specified schema, essentially skipping one manual query.

    if(!group){
        throw new ApiError(404, "Group not found")
    }

    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString())

    if(!isMember){
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
            totalPaid: 0,
            totalOwed: 0,
            netBalances: 0
        }
    })

    expenses.forEach(expense => {
        const payerId = expense.paidBy.toString()

        // The person who paid should get credited
        if(balances[payerId]){
            balances[payerId].totalPaid += expense.totalAmount
        }

        // Each person in splits gets debited their share
        expense.splits.forEach(split => {
            const userId = split.user.toString()
            if(balances[userId]){
                balances[userId].totalOwed += split.amount
            }
        })
    })

    // Calculate net balance for each member 
    const result = Object.values(balances).map(b => ({
        user: b.user,
        totalPaid: Math.round(b.totalPaid * 100) / 100,
        totalOwed: Math.round(b.totalOwed * 100) / 100,
        netBalance: Math.round((b.totalPaid - b.totalOwed) * 100) /  100
    }))

    // Also calculate group total spenditure
    const totalGroupSpendings = expenses.reduce((sum, e) => sum + e.totalAmount, 0)

    res.json({
        groupId,
        totalGroupSpendings: Math.round(totalGroupSpendings * 100) / 100,
    })

})

export const getExpenseById = asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id)
        .populate("paidBy", "username avatar isGuest")
        .populate("splits.user", "username avatar isGuest")
        .populate("items.assignedTo", "username avatar isGuest")
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

export const claimItem = asyncHandler(async (req, res) => {
    const { id: expenseId, itemId } = req.params;
    
    const requestedQuantity = parseInt(req.body.quantity) || 1;

    const initialExpense = await Expense.findById(expenseId);
    if (!initialExpense) {
        throw new ApiError(404, "Expense not found");
    }

    const group = await Group.findById(initialExpense.group);
    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) {
        throw new ApiError(403, "You are not a member of this group");
    }

    // Find the original item to verify its existence and properties
    const item = initialExpense.items.find(i => i._id.toString() === itemId);
    if (!item) {
        throw new ApiError(404, "Item not found");
    }
    
    if (item.assignedTo) {
        throw new ApiError(409, "Item has already been claimed");
    }

    if (requestedQuantity > item.quantity) {
        throw new ApiError(400, "Cannot claim more than available quantity");
    }

    let updatedExpense;

    // Atomic update to handle concurrency
    if (requestedQuantity === item.quantity) {
        // Full claim
        updatedExpense = await Expense.findOneAndUpdate(
            { 
                _id: expenseId, 
                "items._id": itemId, 
                "items.quantity": requestedQuantity,
                "items.assignedTo": null 
            },
            { 
                $set: { "items.$.assignedTo": req.user._id } 
            },
            { new: true }
        );
    } else {
        // Partial claim: Split the item
        // MongoDB cannot $inc an array element and $push to the same array in one operation.
        // Step 1: Atomically check quantity and decrement
        const securedExpense = await Expense.findOneAndUpdate(
            { 
                _id: expenseId, 
                "items._id": itemId, 
                "items.quantity": { $gte: requestedQuantity },
                "items.assignedTo": null 
            },
            { 
                $inc: { "items.$.quantity": -requestedQuantity }
            },
            { new: true }
        );
        
        if (securedExpense) {
            // Step 2: Push the new split item into the secured document
            securedExpense.items.push({
                name: item.name,
                price: item.price,
                quantity: requestedQuantity,
                assignedTo: req.user._id
            });
            updatedExpense = await securedExpense.save();
        }
    }

    if (!updatedExpense) {
        // The item was likely claimed or modified concurrently
        return res.status(409).json({ message: "Item no longer available in that quantity. Please refresh and try again." });
    }

    // Recompute splits based on the newly updated items array
    const TAX_KEYWORDS = ['tax', 'gst', 'vat', 'service charge', 'cess'];
    const isTaxItem = (name) => TAX_KEYWORDS.some(k => name.toLowerCase().includes(k));

    let totalTaxAmount = 0;
    const userSplitTotals = {};
    const participants = new Set();

    updatedExpense.items.forEach(i => {
        if (isTaxItem(i.name)) {
            totalTaxAmount += (i.price * (i.quantity || 1));
        } else if (i.assignedTo) {
            const uid = i.assignedTo.toString();
            if (!userSplitTotals[uid]) userSplitTotals[uid] = 0;
            userSplitTotals[uid] += (i.price * (i.quantity || 1));
            participants.add(uid);
        }
    });

    const participantCount = participants.size;
    const taxPerPerson = participantCount > 0 ? (totalTaxAmount / participantCount) : 0;

    const newSplits = Object.keys(userSplitTotals).map(userId => ({
        user: userId,
        amount: Math.round((userSplitTotals[userId] + taxPerPerson) * 100) / 100
    }));

    // Update splits and save
    updatedExpense.splits = newSplits;
    await updatedExpense.save();

    // Populate for response
    const finalExpense = await Expense.findById(expenseId)
        .populate("paidBy", "username avatar isGuest")
        .populate("splits.user", "username avatar isGuest")
        .populate("items.assignedTo", "username avatar isGuest")
        .populate("createdBy", "username avatar isGuest");

    res.json(finalExpense);
});