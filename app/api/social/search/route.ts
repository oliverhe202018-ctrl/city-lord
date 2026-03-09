import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get('q');

    if (!rawQuery) {
        return NextResponse.json({ users: [] });
    }

    const queryTrimmed = rawQuery.trim();

    if (queryTrimmed.length < 3) {
        return NextResponse.json({ users: [] });
    }

    try {
        const cookieStore = await cookies();
        const supabase = await createClient(cookieStore);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let authIds: string[] = [];

        // 1. Phone matching (exact 11 digits)
        const isPhone = /^\d{11}$/.test(queryTrimmed);
        if (isPhone) {
            const virtualEmail = `${queryTrimmed}@sms.citylord.local`;

            // Primary contract: auth.users.phone
            // Legacy fallback: email = [phone]@sms.citylord.local OR raw_app_meta_data->>'phone'
            // Parameterized queries for absolute SQL injection safety.
            const phoneUsers: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM auth.users 
        WHERE phone = ${queryTrimmed} 
           OR email = ${virtualEmail}
           OR raw_app_meta_data->>'phone' = ${queryTrimmed}
      `;
            authIds = phoneUsers.map(u => u.id);
        }
        // 2. Email matching (exact, normalized)
        else if (queryTrimmed.includes('@')) {
            const normalizedEmail = queryTrimmed.toLowerCase();
            // Primary contract: auth.users.email (parameterized exact match)
            const emailUsers: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM auth.users 
        WHERE lower(email) = ${normalizedEmail}
      `;
            authIds = emailUsers.map(u => u.id);
        }

        // 3. Fallback / Global Search against public profiles
        let usersQuery = supabase
            .from('profiles')
            .select('id, nickname, avatar_url, level, total_area, total_distance_km')
            .limit(10);

        if (authIds.length > 0) {
            // If we found secure exact-match Auth IDs, we query those specifically,
            // but we STILL allow fuzzy nickname search on the same term just in case.
            const idList = authIds.join(',');
            usersQuery = usersQuery.or(`id.in.(${idList}),nickname.ilike.%${queryTrimmed}%`);
        } else {
            // Primary contract: public.profiles.nickname (fuzzy)
            usersQuery = usersQuery.ilike('nickname', `%${queryTrimmed}%`);
        }

        const { data: profiles, error } = await usersQuery;

        if (error) {
            console.error('Search Users DB Error:', error);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
        }

        // Map safely, evaluating friendship statuses
        const profileIds = (profiles || []).map(p => p.id);
        let friendshipsMap: Record<string, string> = {};

        if (profileIds.length > 0) {
            const { data: fData } = await supabase
                .from('friendships')
                .select('user_id, friend_id, status')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            (fData || []).forEach(f => {
                const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
                friendshipsMap[otherId] = f.status; // 'pending' or 'accepted'
            });
        }

        // Enforce absolute privacy: return ONLY public fields + friendStatus. No phones, no emails.
        const mappedUsers = (profiles || [])
            .filter(p => p.id !== user.id) // Self exclusion edge-case handled
            .map((p) => {
                const status = friendshipsMap[p.id] || 'none';
                return {
                    id: p.id,
                    name: p.nickname || 'Unknown Runner',
                    avatar: p.avatar_url,
                    level: p.level || 1,
                    status: 'offline', // UI compatibility
                    hexCount: p.total_area || 0,
                    totalKm: p.total_distance_km || 0,
                    friendStatus: status
                };
            });

        return NextResponse.json({ users: mappedUsers });
    } catch (err: any) {
        console.error('Search API execution error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
