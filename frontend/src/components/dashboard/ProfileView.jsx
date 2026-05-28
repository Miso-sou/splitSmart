import { useState, useEffect, useRef } from 'react'
import {
  KeyRound, ArrowUpCircle, LogOut, Camera, X, Check,
  Pencil, Shield, Users, AlertTriangle, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import GlassButton from '../shared/GlassButton'
import GlassInput from '../shared/GlassInput'
import { cn } from '../../lib/cn'
import toast from 'react-hot-toast'
import { userService } from '../../services/user.service'
import { groupService } from '../../services/group.service'

/* ─── Reusable Section Card ─── */
function SectionCard({ icon: Icon, title, children, className }) {
  return (
    <div className={cn(
      "bg-[#1a1a1a] rounded-2xl border border-white/[0.06] overflow-hidden",
      className
    )}>
      <div className="px-5 pt-5 pb-1 flex items-center gap-2">
        {Icon && <Icon size={14} className="text-[#6b7280]" />}
        <h3 className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-[0.1em]">
          {title}
        </h3>
      </div>
      <div className="px-5 pb-5 pt-3">
        {children}
      </div>
    </div>
  )
}

/* ─── Premium Modal ─── */
function ProfileModal({ isOpen, onClose, title, subtitle, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      />
      {/* Content */}
      <div
        className="relative bg-[#1a1a1a] border border-white/[0.08] rounded-2xl w-full max-w-[420px] shadow-2xl z-10"
        style={{ animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div>
            <h3 className="text-[15px] font-semibold text-white">{title}</h3>
            {subtitle && (
              <p className="text-[12px] text-[#6b7280] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-[#6b7280]" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 pb-6 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── Password Input with eye toggle ─── */
function PasswordInput({ label, value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <GlassInput
        id={id}
        label={label}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-[34px] text-[#6b7280] hover:text-white transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function ProfileView() {
  const { user, upgrade, updateUser } = useAuth()
  const isGuest = user?.isGuest === true
  const fileInputRef = useRef(null)

  // ── State ──
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(user?.username || '')
  const [isSavingName, setIsSavingName] = useState(false)

  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const [upName, setUpName] = useState(user?.username || '')
  const [upEmail, setUpEmail] = useState('')
  const [upPass, setUpPass] = useState('')
  const [upConfirmPass, setUpConfirmPass] = useState('')
  const [isUpgrading, setIsUpgrading] = useState(false)

  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [isLeavingGroup, setIsLeavingGroup] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // ── Effects ──
  useEffect(() => {
    if (user) {
      setTempName(user.username)
      setUpName(user.username)
    }
  }, [user])

  const fetchUserGroups = () => {
    groupService.getGroups()
      .then(res => setGroups(res.data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchUserGroups()
  }, [])

  // ── Handlers ──
  const handleSaveName = async () => {
    const trimmed = tempName.trim()
    if (!trimmed) {
      toast.error('Display name cannot be empty')
      return
    }
    if (trimmed.length < 3 || trimmed.length > 20) {
      toast.error('Must be 3–20 characters')
      return
    }
    if (trimmed === user?.username) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      const res = await userService.updateProfile({ username: trimmed })
      updateUser({ username: res.data.username })
      setIsEditingName(false)
      toast.success('Display name updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name')
      setTempName(user?.username || '')
    } finally {
      setIsSavingName(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset the input so the same file can be selected again
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }

    // Resize image before upload to keep payload small
    const base64 = await resizeImage(file, 256)
    const loadingToast = toast.loading('Uploading avatar…')

    try {
      const res = await userService.updateProfile({ avatar: base64 })
      updateUser({ avatar: res.data.avatar })
      toast.success('Avatar updated', { id: loadingToast })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: loadingToast })
    }
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required')
      return
    }
    if (newPassword.length < 8 || newPassword.length > 30) {
      toast.error('Password must be 8–30 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password')
      return
    }

    setIsResetting(true)
    try {
      await userService.resetPassword(currentPassword, newPassword)
      toast.success('Password changed successfully')
      setIsResetPasswordOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setIsResetting(false)
    }
  }

  const handleUpgradeAccount = async (e) => {
    e.preventDefault()
    if (!upName.trim() || !upEmail.trim() || !upPass || !upConfirmPass) {
      toast.error('All fields are required')
      return
    }
    if (upPass.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (upPass !== upConfirmPass) {
      toast.error('Passwords do not match')
      return
    }

    setIsUpgrading(true)
    try {
      await upgrade(upName.trim(), upEmail.trim(), upPass)
      toast.success('Account upgraded! You are now a full member.')
      setIsUpgradeOpen(false)
      setUpPass('')
      setUpConfirmPass('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upgrade failed')
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!selectedGroupId) return

    setIsLeavingGroup(true)
    try {
      const res = await groupService.leaveGroup(selectedGroupId)
      toast.success(res.data.message || 'Left group')
      setSelectedGroupId('')
      setShowLeaveConfirm(false)
      fetchUserGroups()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave group')
    } finally {
      setIsLeavingGroup(false)
    }
  }

  // ── Helpers ──
  const initials = (user?.username || 'U')
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const selectedGroup = groups.find(g => g._id === selectedGroupId)

  return (
    <section id="profile-view" className="space-y-3">

      {/* ═══ Hero Card ═══ */}
      <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/[0.06] overflow-hidden">
        {/* Gradient accent bar */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-accent-green/60 via-accent-green to-accent-green/60" />

        <div className="p-5 flex items-center gap-4">
          {/* Avatar */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative group w-16 h-16 rounded-2xl bg-[#252525] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/[0.06] shadow-lg cursor-pointer"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-[#6b7280] select-none">{initials}</span>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
              <Camera size={18} className="text-white" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold text-white truncate">
                {user?.username || 'User'}
              </h2>
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider',
                isGuest
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'bg-accent-green/15 text-accent-green border border-accent-green/20'
              )}>
                {isGuest ? 'Guest' : 'Member'}
              </span>
            </div>
            {user?.email ? (
              <p className="text-[13px] text-[#6b7280] mt-0.5 truncate">{user.email}</p>
            ) : (
              <p className="text-[12px] text-[#4b5563] mt-0.5 italic">No email registered</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Guest Upgrade CTA ═══ */}
      {isGuest && (
        <div className="relative bg-gradient-to-br from-accent-green/[0.08] to-transparent rounded-2xl border border-accent-green/20 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent-green/40 to-transparent" />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-accent-green/15 flex items-center justify-center">
                <ArrowUpCircle size={16} className="text-accent-green" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Upgrade to Full Account</h3>
                <p className="text-[11px] text-[#6b7280]">Unlock all features</p>
              </div>
            </div>
            <p className="text-[13px] text-[#8b9298] mb-4 leading-relaxed">
              Create expense groups, manage members, set passwords, and save bills permanently.
            </p>
            <GlassButton
              id="btn-upgrade-account"
              onClick={() => setIsUpgradeOpen(true)}
              className="!bg-accent-green/20 !text-accent-green border border-accent-green/30 hover:!bg-accent-green/30"
            >
              <span className="flex items-center justify-center gap-2">
                <ArrowUpCircle size={14} />
                Register Now
              </span>
            </GlassButton>
          </div>
        </div>
      )}

      {/* ═══ Account Settings ═══ */}
      <SectionCard icon={Shield} title="Account">
        <div className="space-y-4">
          {/* Display Name Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-[#6b7280]">Display Name</label>
              {!isEditingName ? (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="flex items-center gap-1 text-[11px] text-accent-green hover:text-accent-green/80 font-medium transition-colors"
                >
                  <Pencil size={10} />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="flex items-center gap-1 text-[11px] text-accent-green font-medium disabled:opacity-50"
                  >
                    <Check size={10} />
                    {isSavingName ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setIsEditingName(false); setTempName(user?.username || '') }}
                    className="text-[11px] text-[#6b7280] hover:text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <input
              id="input-display-name"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              disabled={!isEditingName}
              placeholder="Your display name"
              onKeyDown={(e) => { if (e.key === 'Enter' && isEditingName) handleSaveName() }}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200',
                'bg-white/[0.05] border',
                isEditingName
                  ? 'text-white border-accent-green/40 focus:outline-none focus:ring-1 focus:ring-accent-green/30'
                  : 'text-[#9ca3af] border-white/[0.06] cursor-default'
              )}
            />
          </div>

          {/* Email Field (read-only) */}
          <div>
            <label className="text-[12px] font-medium text-[#6b7280] mb-1.5 block">Email</label>
            <div className="w-full px-4 py-2.5 rounded-xl text-sm text-[#9ca3af] bg-white/[0.05] border border-white/[0.06]">
              {user?.email || <span className="italic text-[#4b5563]">Not registered</span>}
            </div>
          </div>

          {/* Change Password Button */}
          {!isGuest && (
            <button
              id="btn-reset-password"
              onClick={() => setIsResetPasswordOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
                <KeyRound size={14} className="text-[#6b7280]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Change Password</p>
                <p className="text-[11px] text-[#6b7280]">Update your account password</p>
              </div>
            </button>
          )}
        </div>
      </SectionCard>

      {/* ═══ Groups ═══ */}
      <SectionCard icon={Users} title={`Your Groups (${groups.length})`}>
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="text-center py-6">
              <Users size={24} className="text-[#3a3a3a] mx-auto mb-2" />
              <p className="text-[13px] text-[#6b7280]">No groups yet</p>
              <p className="text-[11px] text-[#4b5563] mt-0.5">Join or create a group from the Groups tab</p>
            </div>
          ) : (
            <>
              {/* Group list */}
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
                {groups.map(g => (
                  <label
                    key={g._id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                      selectedGroupId === g._id
                        ? 'bg-danger/10 border border-danger/25'
                        : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06]'
                    )}
                  >
                    <input
                      type="radio"
                      name="leave-group"
                      value={g._id}
                      checked={selectedGroupId === g._id}
                      onChange={() => setSelectedGroupId(g._id)}
                      className="hidden"
                    />
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      selectedGroupId === g._id
                        ? 'border-danger bg-danger'
                        : 'border-[#4b5563]'
                    )}>
                      {selectedGroupId === g._id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-[13px] truncate">
                      {g.icon && <span className="mr-1.5">{g.icon}</span>}
                      <span className={selectedGroupId === g._id ? 'text-danger font-medium' : 'text-white'}>
                        {g.name}
                      </span>
                    </span>
                    <span className="ml-auto text-[10px] text-[#4b5563] shrink-0">
                      {g.members?.length || 0} members
                    </span>
                  </label>
                ))}
              </div>

              {/* Leave button */}
              {selectedGroupId && !showLeaveConfirm && (
                <GlassButton
                  id="btn-leave-group"
                  variant="danger"
                  onClick={() => setShowLeaveConfirm(true)}
                >
                  <span className="flex items-center justify-center gap-2">
                    <LogOut size={14} />
                    Leave {selectedGroup?.name || 'Group'}
                  </span>
                </GlassButton>
              )}

              {/* Confirmation */}
              {showLeaveConfirm && selectedGroupId && (
                <div className="bg-danger/10 border border-danger/25 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
                    <p className="text-[13px] text-danger leading-snug">
                      Leave <strong>{selectedGroup?.name}</strong>? You won't be able to rejoin without a new invite.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <GlassButton
                      variant="ghost"
                      onClick={() => setShowLeaveConfirm(false)}
                      className="flex-1 !py-2"
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      variant="danger"
                      disabled={isLeavingGroup}
                      onClick={handleLeaveGroup}
                      className="flex-1 !py-2"
                    >
                      {isLeavingGroup ? 'Leaving…' : 'Confirm Leave'}
                    </GlassButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* ═══ Reset Password Modal ═══ */}
      <ProfileModal
        isOpen={isResetPasswordOpen}
        onClose={() => {
          setIsResetPasswordOpen(false)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        }}
        title="Change Password"
        subtitle="Enter your current password and choose a new one"
      >
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="space-y-3">
            <PasswordInput
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <div className="h-px bg-white/[0.04]" />
            <PasswordInput
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
            <PasswordInput
              id="confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
            {/* Strength indicator */}
            {newPassword && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      newPassword.length < 8 ? 'w-1/4 bg-danger' :
                      newPassword.length < 12 ? 'w-2/4 bg-amber-400' :
                      newPassword.length < 16 ? 'w-3/4 bg-accent-green/70' :
                      'w-full bg-accent-green'
                    )}
                  />
                </div>
                <span className={cn(
                  'text-[10px] font-medium',
                  newPassword.length < 8 ? 'text-danger' :
                  newPassword.length < 12 ? 'text-amber-400' :
                  'text-accent-green'
                )}>
                  {newPassword.length < 8 ? 'Too short' :
                   newPassword.length < 12 ? 'Fair' :
                   newPassword.length < 16 ? 'Good' : 'Strong'}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => {
                setIsResetPasswordOpen(false)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
              }}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              disabled={isResetting || !currentPassword || !newPassword || !confirmPassword}
              className="flex-1"
            >
              {isResetting ? 'Saving…' : 'Update Password'}
            </GlassButton>
          </div>
        </form>
      </ProfileModal>

      {/* ═══ Upgrade Account Modal ═══ */}
      <ProfileModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        title="Register Account"
        subtitle="Set up an email & password to unlock all features"
      >
        <form onSubmit={handleUpgradeAccount} className="space-y-4">
          <div className="space-y-3">
            <GlassInput
              id="upgrade-username"
              label="Username"
              value={upName}
              onChange={(e) => setUpName(e.target.value)}
              placeholder="Choose a username"
            />
            <GlassInput
              id="upgrade-email"
              label="Email Address"
              type="email"
              value={upEmail}
              onChange={(e) => setUpEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <PasswordInput
              id="upgrade-password"
              label="Password"
              value={upPass}
              onChange={(e) => setUpPass(e.target.value)}
              placeholder="Min. 8 characters"
            />
            <PasswordInput
              id="upgrade-confirm-password"
              label="Confirm Password"
              value={upConfirmPass}
              onChange={(e) => setUpConfirmPass(e.target.value)}
              placeholder="Re-enter password"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setIsUpgradeOpen(false)}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              disabled={isUpgrading}
              className="flex-1 !bg-accent-green/20 !text-accent-green border border-accent-green/30 hover:!bg-accent-green/30"
            >
              {isUpgrading ? 'Upgrading…' : 'Create Account'}
            </GlassButton>
          </div>
        </form>
      </ProfileModal>

      {/* ── Inline keyframe animations ── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </section>
  )
}

/* ─── Utility: resize image to max dimension and return Base64 ─── */
function resizeImage(file, maxSize = 256) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height

        // Scale down proportionally
        if (w > h) {
          if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize }
        } else {
          if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize }
        }

        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)

        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
