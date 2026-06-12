import Group from "../models/group.model.js";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import Expense from "../models/expense.model.js";
import Settlement from "../models/settlement.model.js";
import { simplifyDebts } from "../utils/debtSimplification.js";

// Create a group
export const createGroup = asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body;

  if (!name) {
    throw new ApiError(400, "Group name is required");
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");

  const group = await Group.create({
    name,
    description,
    icon: icon || '',
    createdBy: req.user._id,
    members: [
      {
        user: req.user._id,
        role: "admin",
      },
    ],
    inviteToken,
    inviteTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.status(201).json(group);
});

//Find all groups where member's list contains requested users id - find all groups where user is a member
export const getGroups = asyncHandler(async (req, res) => {
  const groups = await Group.find({
    "members.user": req.user._id,
  }).populate("members.user", "username email avatar").lean();

  res.status(200).json(groups);
});

// Find a group by id (with also auth check so that if they are not part of that group they can't see that group)
export const getGroupById = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id)
    .populate("members.user", "username email avatar isGuest")
    .lean();

  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const isMember = group.members.some(
    (m) => m.user._id.toString() === req.user._id.toString(), // this piece of code checks if the requesting user really is a member of the group they gave group ID for.
  );

  if (!isMember) {
    throw new ApiError(
      403,
      "Not authorized — you are not a member of this group",
    );
  }

  res.json(group);
});

export const joinGroup = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const group = await Group.findOne({
    inviteToken: token,
    inviteTokenExpiry: { $gt: new Date() },
  });

  if (!group) {
    throw new ApiError(400, "Invalid or expired invite token");
  }

  const alreadyMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!alreadyMember) {
    group.members.push({
      user: req.user._id, // role defaults to member
    });

    await group.save();
  }

  res.json(group);
});

export const genrateInvite = asyncHandler(async (req, res) => {
  const inviteToken = crypto.randomBytes(32).toString("hex");
  req.group.inviteToken = inviteToken;
  req.group.inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await req.group.save();

  res.json({
    inviteLink: `${process.env.CLIENT_URL}/join/${inviteToken}`,
  });
});

export const updateGroup = asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body;

  // These two if can directly access group.field because in routes the requireAdmin middleware attaches the group to req body
  if (name) req.group.name = name;
  if (description !== undefined) req.group.description = description;
  if (icon !== undefined) req.group.icon = icon;

  await req.group.save();

  res.json(req.group);
});

export const deleteGroup = asyncHandler(async (req, res) => {
  await req.group.deleteOne();
  res.json({ messge: "Group deleted successfully." });
});

export const removeMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    throw new ApiError(
      400,
      "You cannot remove yourself from the group. If you'd like to delete group then head to delete group option",
    );
  }

  const memberIndex = req.group.members.findIndex(
    (m) => m.user.toString() === userId,
  );

  if (memberIndex === -1) {
    throw new ApiError(404, "User is not a member of this group");
  }

  // Calculate the user's balance in the group.
  const [expensesRaw, settlements] = await Promise.all([
    Expense.find({
      group: req.group._id,
      approvalStatus: "approved",
    }).lean(),
    Settlement.find({ group: req.group._id }).lean(),
  ]);

  let expenses = expensesRaw.filter((e) => {
    const splitsSum = e.splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(splitsSum - e.totalAmount) < 1.0;
  });

  const balance = {};

  expenses.forEach((e) => {
    const uid = e.paidBy.toString();
    balance[uid] = (balance[uid] || 0) + e.totalAmount;
    e.splits.forEach((split) => {
      const splitUid = split.user.toString();
      balance[splitUid] = (balance[splitUid] || 0) - split.amount;
    });
  });

  settlements.forEach((s) => {
    const fromId = s.from.toString();
    const toId = s.to.toString();
    balance[fromId] = (balance[fromId] || 0) + s.amount;
    balance[toId] = (balance[toId] || 0) - s.amount;
  });

  const net = Math.round((balance[userId] || 0) * 100) / 100;

  if (Math.abs(net) > 0.02) {
    throw new ApiError(
      400,
      `You cannot remove this member because they have an unsettled balance of ${net > 0 ? "+" : ""}${net.toFixed(2)}. Please settle all balances before removing them.`
    );
  }

  req.group.members.splice(memberIndex, 1);
  await req.group.save();

  res.json({ message: "Member removed successfully" });
});

export const getSettlement = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.time("groupFindAndPopulate");
  const group = await Group.findById(id)
    .populate("members.user", "username avatar")
    .lean();
  console.timeEnd("groupFindAndPopulate");

  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const isMember = group.members.some(
    (m) => m.user._id.toString() === req.user._id.toString(),
  );
  if (!isMember) {
    throw new ApiError(403, "You are not a member of this group");
  }

  console.time("expensesQuery");
  const expensesPromise = Expense.find({
    group: id,
    approvalStatus: "approved",
  }).lean().then(res => {
    console.timeEnd("expensesQuery");
    return res;
  });

  console.time("settlementsQuery");
  const settlementsPromise = Settlement.find({ group: id }).lean().then(res => {
    console.timeEnd("settlementsQuery");
    return res;
  });

  console.time("expensesAndSettlementsFind");
  const [expensesRaw, settlements] = await Promise.all([
    expensesPromise,
    settlementsPromise,
  ]);
  console.timeEnd("expensesAndSettlementsFind");

  let expenses = expensesRaw.filter(e => {
    // Sum all split amounts
    const splitsSum = e.splits.reduce((sum, split) => sum + split.amount, 0);

    // In equal or custom splits, splitsSum will equal totalAmount upon creation.
    // In item-based splits, splitsSum starts at 0 and only reaches totalAmount when all items are claimed.
    // We use a small epsilon (1.0) to account for rounding errors in tax divisions.
    if (Math.abs(splitsSum - e.totalAmount) < 1.0) {
      return true;
    }

    // If splits do not sum to totalAmount, the bill is not fully claimed.
    return false;
  });

  console.time("processing");

  // Compute total expenses manually to build memberStats
  const balance = {};
  const expenseTotals = {};

  expenses.forEach(e => {
    const uid = e.paidBy.toString();

    // Find the payer's own split share to represent their actual out-of-pocket spending
    const payerSplit = e.splits.find(s => s.user.toString() === uid);
    const payerShare = payerSplit ? payerSplit.amount : 0;

    expenseTotals[uid] = (expenseTotals[uid] || 0) + payerShare;

    balance[uid] = (balance[uid] || 0) + e.totalAmount;
    e.splits.forEach(split => {
      const splitUid = split.user.toString();
      balance[splitUid] = (balance[splitUid] || 0) - split.amount;
    });
  });

  // Subtract settled amounts and add to totalPaid for the sender
  settlements.forEach(s => {
    const fromId = s.from.toString();
    const toId = s.to.toString();
    balance[fromId] = (balance[fromId] || 0) + s.amount;
    balance[toId] = (balance[toId] || 0) - s.amount;

    // Add settlement paid to the sender's totalPaid
    expenseTotals[fromId] = (expenseTotals[fromId] || 0) + s.amount;
  });

  const memberStats = group.members.map(m => {
    const uid = m.user._id.toString();
    const net = Math.round((balance[uid] || 0) * 100) / 100;
    return {
      user: m.user,
      totalPaid: expenseTotals[uid] || 0,
      netBalance: Math.abs(net) < 0.02 ? 0 : net
    };
  });

  // Feed into simplifyDebts without changing its signature by creating pseudo-expenses from settlements
  const pseudoExpenses = settlements.map(s => ({
    paidBy: s.from,
    totalAmount: s.amount,
    splits: [{ user: s.to, amount: s.amount }]
  }));

  const transactions = simplifyDebts([...expenses, ...pseudoExpenses]);

  const memberMap = {};
  group.members.forEach((m) => {
    memberMap[m.user._id.toString()] = m.user;
  });

  const enrichedTransactions = transactions.map((t) => ({
    from: memberMap[t.from] || t.from,
    to: memberMap[t.to] || t.to,
    amount: t.amount,
  }));

  const totalGroupSpendings = expenses.reduce((sum, s) => sum + s.totalAmount, 0);

  res.json({
    groupId: id,
    totalGroupSpendings: Math.round(totalGroupSpendings * 100) / 100,
    transactions: enrichedTransactions,
    memberStats
  });

  console.timeEnd("processing");
});

// Leave a group
export const leaveGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [group, expensesRaw, settlements] = await Promise.all([
    Group.findById(id),
    Expense.find({
      group: id,
      approvalStatus: "approved",
    }).lean(),
    Settlement.find({ group: id }).lean(),
  ]);

  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const member = group.members.find(
    (m) => m.user.toString() === req.user._id.toString()
  );

  if (!member) {
    throw new ApiError(403, "Not authorized — you are not a member of this group");
  }

  // 1. Calculate the user's balance in the group.
  let expenses = expensesRaw.filter((e) => {
    const splitsSum = e.splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(splitsSum - e.totalAmount) < 1.0;
  });

  const balance = {};

  expenses.forEach((e) => {
    const uid = e.paidBy.toString();
    balance[uid] = (balance[uid] || 0) + e.totalAmount;
    e.splits.forEach((split) => {
      const splitUid = split.user.toString();
      balance[splitUid] = (balance[splitUid] || 0) - split.amount;
    });
  });

  settlements.forEach((s) => {
    const fromId = s.from.toString();
    const toId = s.to.toString();
    balance[fromId] = (balance[fromId] || 0) + s.amount;
    balance[toId] = (balance[toId] || 0) - s.amount;
  });

  const myUid = req.user._id.toString();
  const net = Math.round((balance[myUid] || 0) * 100) / 100;

  if (Math.abs(net) > 0.02) {
    throw new ApiError(
      400,
      `You cannot leave this group because you have an unsettled balance of ${net > 0 ? "+" : ""
      }${net.toFixed(2)}. Please settle all balances before leaving.`
    );
  }

  // 2. Admin validation: If the user is the only admin, verify if there are other members and prompt them to assign another admin.
  if (member.role === "admin") {
    const otherAdmins = group.members.filter(
      (m) => m.role === "admin" && m.user.toString() !== myUid
    );
    if (otherAdmins.length === 0) {
      const otherMembers = group.members.filter(
        (m) => m.user.toString() !== myUid
      );
      if (otherMembers.length > 0) {
        throw new ApiError(
          400,
          "You are the only admin of this group. Please promote another member to admin before leaving."
        );
      }
    }
  }

  // 3. Remove the member. If they are the only member left in the group, we can delete the group automatically.
  if (group.members.length <= 1) {
    await group.deleteOne();
    return res.status(200).json({
      message: "Left group successfully. Since you were the only member, the group has been deleted.",
      deleted: true,
    });
  }

  group.members = group.members.filter(
    (m) => m.user.toString() !== myUid
  );
  await group.save();

  res.status(200).json({
    message: "Left group successfully",
    deleted: false,
  });
});

export const promoteMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const member = req.group.members.find(
    (m) => m.user.toString() === userId,
  );

  if (!member) {
    throw new ApiError(404, "User is not a member of this group");
  }

  if (member.role === "admin") {
    throw new ApiError(400, "User is already an admin");
  }

  const userToPromote = await User.findById(userId).lean();
  if (!userToPromote) {
    throw new ApiError(404, "User not found");
  }

  if (userToPromote.isGuest) {
    throw new ApiError(400, "Guest accounts cannot be promoted to admin. They must register first.");
  }

  member.role = "admin";
  await req.group.save();

  res.status(200).json({
    message: "Member promoted to admin successfully",
    group: req.group
  });
});

export const demoteMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const member = req.group.members.find(
    (m) => m.user.toString() === userId,
  );

  if (!member) {
    throw new ApiError(404, "User is not a member of this group");
  }

  if (member.role !== "admin") {
    throw new ApiError(400, "User is not an admin");
  }

  // Prevent demotion if they are the only admin
  const otherAdmins = req.group.members.filter(
    (m) => m.role === "admin" && m.user.toString() !== userId
  );
  if (otherAdmins.length === 0) {
    throw new ApiError(
      400,
      "You cannot demote the only admin of this group. Please promote another member to admin first."
    );
  }

  member.role = "member";
  await req.group.save();

  res.status(200).json({
    message: "Member demoted to member successfully",
    group: req.group
  });
});

