import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data } = await supabase.from('profiles').select('*').eq('insead_email', 'ali.elsayed@insead.edu').single()
  console.log(JSON.stringify(data, null, 2))
}
run()
