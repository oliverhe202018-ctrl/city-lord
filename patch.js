const fs = require('fs');
let content = fs.readFileSync('types/supabase.ts', 'utf8');

// Add owner_club_id and owner_faction to territories Row
if (!content.includes('owner_faction: string | null')) {
    // Add to Row
    content = content.replace(
        /owner_change_count: number \| null/,
        'owner_change_count: number | null\n          owner_club_id: string | null\n          owner_faction: string | null'
    );
    // Add to Insert
    content = content.replace(
        /owner_change_count\?: number \| null/,
        'owner_change_count?: number | null\n          owner_club_id?: string | null\n          owner_faction?: string | null'
    );
    // Add to Update (using another optional match since Update all have ?)
    content = content.replace(
        /owner_change_count\?: number \| null/, // Because it replaces first occurrence which is now Update since Insert is already replaced above? Wait, replace with global.
        'owner_change_count?: number | null\n          owner_club_id?: string | null\n          owner_faction?: string | null'
    );

    const eventsTable = `
      territory_events: {
        Row: {
          action_id: string | null
          created_at: string | null
          event_type: string
          id: number
          new_club_id: string | null
          new_faction: string | null
          new_owner_id: string | null
          old_club_id: string | null
          old_faction: string | null
          old_owner_id: string | null
          processed_at: string | null
          processed_for_stats: boolean | null
          processor_version: string | null
          source_request_id: string | null
          territory_id: string
          user_id: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string | null
          event_type: string
          id?: never
          new_club_id?: string | null
          new_faction?: string | null
          new_owner_id?: string | null
          old_club_id?: string | null
          old_faction?: string | null
          old_owner_id?: string | null
          processed_at?: string | null
          processed_for_stats?: boolean | null
          processor_version?: string | null
          source_request_id?: string | null
          territory_id: string
          user_id?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: never
          new_club_id?: string | null
          new_faction?: string | null
          new_owner_id?: string | null
          old_club_id?: string | null
          old_faction?: string | null
          old_owner_id?: string | null
          processed_at?: string | null
          processed_for_stats?: boolean | null
          processor_version?: string | null
          source_request_id?: string | null
          territory_id?: string
          user_id?: string | null
        }
        Relationships: []
      }`;

    content = content.replace(/user_badges: \{/g, eventsTable.trim() + '\n      user_badges: {');

    fs.writeFileSync('types/supabase.ts', content, 'utf8');
    console.log('Types patched successfully!');
} else {
    console.log('Types already patched!');
}
