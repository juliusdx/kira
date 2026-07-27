// Daily review reminders over Web Push.
//
// Invoked on a schedule (hourly). Each run asks the database which
// subscriptions are due a nudge RIGHT NOW in their own local hour, then sends
// one encrypted push each.
//
// Deploy:
//   supabase functions deploy send-reminders --project-ref ccbioktxfpeqaocjkqpr
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
//
// The heavy lifting (VAPID JWT + aes128gcm encryption) comes from a maintained
// library rather than hand-rolled crypto — getting ECDH/HKDF wrong here fails
// silently or leaks, and neither is worth the risk.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:juliusykong@gmail.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

interface DueRow {
  endpoint: string
  p256dh: string
  auth: string
  due_count: number
  local_date: string
}

/** Bilingual, because the app is. Kept short — notifications get truncated. */
function body(n: number, locale: 'ms' | 'en') {
  if (locale === 'en') {
    return n === 1 ? '1 review is waiting.' : `${n} reviews are waiting.`
  }
  return n === 1 ? '1 ulang kaji menunggu.' : `${n} ulang kaji menunggu.`
}

Deno.serve(async (req) => {
  // Only the scheduler should be able to fire this.
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase.rpc('due_reminders')
  if (error) {
    console.error('due_reminders failed', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const rows = (data ?? []) as DueRow[]
  let sent = 0
  let failed = 0
  let pruned = 0

  await Promise.all(
    rows.map(async (r) => {
      const payload = JSON.stringify({
        title: 'Kira',
        body: body(Number(r.due_count), 'ms'),
        url: '/',
        count: Number(r.due_count),
      })

      try {
        await webpush.sendNotification(
          {
            endpoint: r.endpoint,
            keys: { p256dh: r.p256dh, auth: r.auth },
          },
          payload,
          { TTL: 6 * 60 * 60 }, // a reminder is worthless once the day has moved on
        )
        await supabase.rpc('mark_reminder_sent', {
          p_endpoint: r.endpoint,
          p_date: r.local_date,
        })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // 404/410 mean the browser threw the subscription away — it is never
        // coming back, so delete rather than retry it forever.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', r.endpoint)
          pruned++
        } else {
          console.error('push failed', status, (e as Error).message)
          await supabase.rpc('mark_reminder_failed', { p_endpoint: r.endpoint })
          failed++
        }
      }
    }),
  )

  console.log(`reminders: ${sent} sent, ${failed} failed, ${pruned} pruned`)
  return Response.json({ candidates: rows.length, sent, failed, pruned })
})
