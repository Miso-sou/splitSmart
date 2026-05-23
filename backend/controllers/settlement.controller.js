import Settlement from "../models/settlement.model.js";
import Group from "../models/group.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

export const createSettlement = asyncHandler(async (req, res) => {
  const { groupId, toUserId, amount, note } = req.body;

  if (!groupId || !toUserId || !amount) {
    throw new ApiError(400, "Group ID, toUserId, and amount are required");
  }

  if (amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const fromUserId = req.user._id.toString();

  const isFromMember = group.members.some((m) => m.user.toString() === fromUserId);
  const isToMember = group.members.some((m) => m.user.toString() === toUserId);

  if (!isFromMember || !isToMember) {
    throw new ApiError(400, "Both users must be members of the group");
  }

  const newSettlement = await Settlement.create({
    group: groupId,
    from: fromUserId,
    to: toUserId,
    amount,
    note: note || "",
    createdBy: req.user._id,
  });

  const populatedSettlement = await Settlement.findById(newSettlement._id)
    .populate("from", "username avatar")
    .populate("to", "username avatar");

  res.status(201).json(populatedSettlement);
});

export const getSettlementsByGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.query;

  if (!groupId) {
    throw new ApiError(400, "Group ID is required");
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );

  if (!isMember) {
    throw new ApiError(403, "You are not a member of this group");
  }

  const settlements = await Settlement.find({ group: groupId })
    .populate("from", "username avatar")
    .populate("to", "username avatar")
    .sort({ settledAt: -1 });

  res.json(settlements);
});
