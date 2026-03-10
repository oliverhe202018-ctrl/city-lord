const fs = require('fs');
let content = fs.readFileSync('types/supabase.ts', 'utf8');

if (!content.includes('owner_faction: string | null')) {
    // Add to Row
    content = content.replace(
        /owner_change_count: number \| null/,
        'owner_change_count: number | null\n          owner_club_id: string | null\n          owner_faction: string | null'
    );

    // Find the position of 'Insert: {' inside 'territories: {'
    const territoriesStart = content.indexOf('territories: {');
    const insertStart = content.indexOf('Insert: {', territoriesStart);
    const updateStart = content.indexOf('Update: {', territoriesStart);

    // Replace in Insert
    content = content.substring(0, insertStart) +
        content.substring(insertStart, updateStart).replace(
            /owner_change_count\?: number \| null/,
            'owner_change_count?: number | null\n          owner_club_id?: string | null\n          owner_faction?: string | null'
        ) +
        content.substring(updateStart).replace(
            /owner_change_count\?: number \| null/,
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
    console.log('Types patched successfully without duplicates!');
} else {
    console.log('Types already patched!');
}
