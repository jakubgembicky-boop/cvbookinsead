import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('Fetching auth users...')
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) {
    console.error('Error fetching users:', authErr)
    return
  }

  console.log(`Found ${users.length} registered users. Linking...`)
  let linked = 0
  for (const user of users) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, user_id, insead_email')
      .eq('insead_email', user.email)
      .single()

    if (profile && profile.user_id !== user.id) {
      console.log(`Linking ${user.email} -> user_id: ${user.id}`)
      await supabase
        .from('profiles')
        .update({ user_id: user.id })
        .eq('id', profile.id)
      linked++
    }
  }
  console.log(`Successfully relinked ${linked} profiles.`)
}

run()
