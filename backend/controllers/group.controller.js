import Group from "../models/group.model.js";
import crypto from "crypto";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

// Create a group
export const createGroup = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(400, "Group name is required");
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");

  const group = await Group.create({
    name,
    description,
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
  }).populate("members.user", "username email avatar");

  res.status(200).json(groups);
});

// Find a group by id (with also auth check so that if they are not part of that group they can't see that group)
export const getGroupById = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id).populate(
    "members.user",
    "username email avatar"
  );

  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const isMember = group.members.some(
    (m) => m.user._id.toString() === req.user._id.toString() // this piece of code checks if the requesting user really is a member of the group they gave group ID for. 
  );

  if (!isMember) {
    throw new ApiError(403, "Not authorized — you are not a member of this group");
  }

  res.json(group);
});

export const joinGroup = asyncHandler(async (req, res) => {
  const {token} = req.params

  const group = await Group.findOne({
    inviteToken: token,
    inviteTokenExpiry: {$gt: new Date()}
  })

  if(!group){
    throw new ApiError(400, "Invalid or expired invite token")
  }

  const alreadyMember = group.members.some(
    m => m.user.toString() === req.user._id.toString()
  )

  if(!alreadyMember){
    group.members.push({
      user: req.user._id // role defaults to member
    })

    await group.save()
  }

  res.json(group)
});

export const genrateInvite = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id)
  if(!group){
    throw new ApiError(404, "Group not found")
  }

  const isAdmin = group.members.some(
    m => m.user.toString() === req.user._id.toString() && m.role === 'admin' // if the user who requested 
  )

  if(!isAdmin){
    throw new ApiError(403, "Only admins can generate invite links")
  }

  const inviteToken = crypto.randomBytes(32).toString('hex')
  group.inviteToken = inviteToken
  group.inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await group.save()

  res.json({
    inviteLink: `${process.env.CLIENT_URL}/join/${inviteToken}`
  })
})

export const updateGroup = asyncHandler(async (req, res) => {
  
})