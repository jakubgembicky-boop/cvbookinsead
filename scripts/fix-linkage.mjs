import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// 1. Link every existing auth user to their migrated profile by email
const { data: usersResp, error: usersErr } = await sb.auth.admin.listUsers()
if (usersErr) { console.error('listUsers error', usersErr); process.exit(1) }

let linked = 0, created = 0
for (const u of usersResp.users) {
  if (!u.email) continue
  // Try to link an existing profile row
  const { data: updated, error: updErr } = await sb
    .from('profiles')
    .update({ user_id: u.id })
    .ilike('insead_email', u.email)
    .is('user_id', null)
    .select('id')
  if (updErr) { console.error('link error for', u.email, updErr.message); continue }

  if (updated && updated.length > 0) {
    linked++
    console.log(`[LINKED] ${u.email} -> profile ${updated[0].id}`)
  } else {
    // Check if already linked
    const { data: existing } = await sb.from('profiles').select('id').eq('user_id', u.id).maybeSingle()
    if (existing) {
      console.log(`[OK] ${u.email} already linked`)
    } else {
      // No profile row at all — create a minimal one
      const { error: insErr } = await sb.from('profiles').insert({
        user_id: u.id, insead_email: u.email, first_name: '', last_name: '',
      })
      if (insErr) console.error('create error for', u.email, insErr.message)
      else { created++; console.log(`[CREATED] minimal profile for ${u.email}`) }
    }
  }
}

// 2. Create the 'profiles' storage bucket (public) for avatar uploads
const { data: buckets } = await sb.storage.listBuckets()
if (!buckets?.some((b) => b.name === 'profiles')) {
  const { error: bErr } = await sb.storage.createBucket('profiles', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  })
  if (bErr) console.error('createBucket error', bErr.message)
  else console.log("[BUCKET] created public 'profiles' bucket")
} else {
  console.log("[BUCKET] 'profiles' already exists")
}

console.log(`\nDone. Linked: ${linked}, Created: ${created}`)
