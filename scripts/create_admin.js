#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ADMIN_EMAIL || 'devadmin@example.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'StrongPassword123!'

if (!url || !key) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const supabase = createClient(url, key)

async function run() {
  console.log('Creating user:', adminEmail)
  const { data, error: createErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  })
  if (createErr) {
    console.error('createUser error:', createErr)
    process.exit(1)
  }

  const user = data?.user ?? data
  const userId = user?.id
  console.log('Created user id:', userId)

  if (!userId) {
    console.error('Could not determine created user id')
    process.exit(1)
  }

  // Upsert profile and set is_admin = true (adjust table name if different)
  const { data: profData, error: profErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, email: adminEmail, is_admin: true }, { returning: 'representation' })

  if (profErr) {
    console.error('profiles upsert error:', profErr)
    process.exit(1)
  }

  console.log('Profile upserted:', profData)
  console.log('Done. You can sign in at /login with the credentials you provided.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
