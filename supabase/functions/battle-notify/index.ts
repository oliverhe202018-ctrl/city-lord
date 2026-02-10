// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')!

serve(async (req) => {
  try {
    const { record, old_record, type } = await req.json()
    
    // Logic: Listen to Territory Updates
    // Trigger when owner_id changes (Invasion/Conquest)
    
    if (type === 'UPDATE' && record.owner_id && old_record.owner_id && record.owner_id !== old_record.owner_id) {
        
        const newOwnerId = record.owner_id
        const oldOwnerId = old_record.owner_id
        const territoryName = record.name || 'Unknown Territory'
        
        // Notify Old Owner (Defense Alert)
        // 1. Send OneSignal Push (External)
        await sendNotification({
            userId: oldOwnerId,
            title: "⚔️ 领地失守警报！",
            message: `你的领地 [${territoryName}] 刚刚被攻占！快去夺回来！`,
            data: { type: 'battle_alert', territoryId: record.id }
        })

        // 2. Insert into Internal Notifications Table (Realtime Fallback)
        await insertInternalNotification(oldOwnerId, "⚔️ 领地失守警报！", `你的领地 [${territoryName}] 刚刚被攻占！快去夺回来！`, 'battle_alert', { territoryId: record.id });
        
        // Notify New Owner (Success)
        // Usually handled by client Toast, but push is good for background confirmation
        // await sendNotification({
        //     userId: newOwnerId,
        //     title: "🚩 占领成功",
        //     message: `你已成功占领 [${territoryName}]！`,
        //     data: { type: 'conquest_success', territoryId: record.id }
        // })
    }

    return new Response(JSON.stringify({ message: 'Processed' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function insertInternalNotification(userId: string, title: string, body: string, type: string, data: any) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            title: title,
            body: body,
            type: type,
            data: data,
            is_read: false
        });

    if (error) {
        console.error("Internal Notification Insert Failed:", error);
    } else {
        console.log("Internal Notification Inserted for:", userId);
    }
}

async function sendNotification({ userId, title, message, data }: any) {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
        console.error("OneSignal Config Missing")
        return
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Basic ${ONESIGNAL_API_KEY}`
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [userId], // Target specific user
            headings: { en: title },
            contents: { en: message },
            data: data
        })
    })
    
    const result = await response.json()
    console.log("Notification Result:", result)
}
