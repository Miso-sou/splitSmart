import express from 'express'
import { protect, requireAdmin, requireRegistered } from '../middleware/auth.middleware.js'
import { createGroup, getGroupById, getGroups, joinGroup, updateGroup, genrateInvite, deleteGroup, removeMember } from '../controllers/group.controller.js'

const router = express.Router()

// All routes henceforth will first run protect middleware
router.use(protect)

// Any authenticated member can do this
router.post("/", requireRegistered, createGroup)
router.get("/", getGroups)
router.get("/:id", getGroupById)
router.post("/join/:token", joinGroup)

// Only admin can use these routes
router.put("/:id", requireAdmin, updateGroup)
router.delete("/:id", requireAdmin, deleteGroup)
router.post("/:id/:invite", requireAdmin, genrateInvite)
router.delete("/:id/members/:userId", requireAdmin, removeMember)

export default router;