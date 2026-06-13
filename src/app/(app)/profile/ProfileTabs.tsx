'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ProfileEditor } from '@/components/app/ProfileEditor'
import type { EnrichedProfile } from '@/types'
import { User, Shield, Database } from 'lucide-react'
import { z } from 'zod'

type TabId = 'edit' | 'security' | 'data'

const passwordSchema = z
  .string()
  .min(12, 'At least 12 characters')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/[0-9]/, 'One number')
  .regex(/[^A-Za-z0-9]/, 'One special character')

export function ProfileTabs({
  enriched,
  inseadEmail,
}: {
  enriched: EnrichedProfile
  inseadEmail: string
}) {
  const { success, error: toastError } = useToast()
  const supabase = createClient()
  const [tab, setTab] = useState<TabId>('edit')

  // Security
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  // Delete
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const handleChangePassword = async () => {
    setPwError(null)
    const parsed = passwordSchema.safeParse(newPassword)
    if (!parsed.success) {
      setPwError(parsed.error.issues[0].message)
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPwError(error.message)
    else {
      success('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPw(false)
  }

  const handleSignOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) toastError(error.message)
    else success('Signed out of all other devices.')
  }

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'edit', label: 'Edit Profile', icon: <User className="h-4 w-4" /> },
    { id: 'security', label: 'Account & Security', icon: <Shield className="h-4 w-4" /> },
    { id: 'data', label: 'Data & Privacy', icon: <Database className="h-4 w-4" /> },
  ]

  return (
    <>
      <div className="flex gap-1 border-b border-gray-100 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-[#003781] text-[#003781]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === 'edit' && <ProfileEditor initial={enriched} />}

      {tab === 'security' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
            <div className="space-y-4 max-w-md">
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="Min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char"
              />
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: '12+ characters', ok: newPassword.length >= 12 },
                  { label: 'Uppercase', ok: /[A-Z]/.test(newPassword) },
                  { label: 'Lowercase', ok: /[a-z]/.test(newPassword) },
                  { label: 'Number', ok: /[0-9]/.test(newPassword) },
                  { label: 'Special char', ok: /[^A-Za-z0-9]/.test(newPassword) },
                ].map(({ label, ok }) => (
                  <span
                    key={label}
                    className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    <span>{ok ? '✓' : '○'}</span>
                    {label}
                  </span>
                ))}
              </div>
              <Input
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {pwError && <p className="text-sm text-[#E4002B]">{pwError}</p>}
              <Button onClick={handleChangePassword} loading={savingPw}>
                Update password
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Active Sessions</h2>
            <p className="text-sm text-gray-500 mb-4">
              Sign out of all other devices where your account is signed in.
            </p>
            <Button variant="secondary" onClick={handleSignOutOthers}>
              Sign out other devices
            </Button>
          </Card>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Export Your Data</h2>
            <p className="text-sm text-gray-500 mb-4">
              Download a copy of your profile and original CV information as JSON.
            </p>
            <a href="/api/profile/export" download>
              <Button variant="secondary">Download My Data</Button>
            </a>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#E4002B] mb-2">Delete Account</h2>
            <p className="text-sm text-gray-500 mb-4">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              Delete my account
            </Button>
          </Card>
        </div>
      )}

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Account" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            This permanently deletes your account. Type <span className="font-mono font-bold">DELETE</span> to confirm.
          </p>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={deleteConfirm !== 'DELETE'}
              onClick={() => {
                toastError('Account deletion requires admin action — contact the administrator.')
                setShowDelete(false)
              }}
            >
              Delete account
            </Button>
          </div>
        </div>
      </Modal>

      <p className="mt-6 text-center text-xs text-gray-400">
        Signed in as {inseadEmail}
      </p>
    </>
  )
}
