import { createClient } from '@/lib/supabase/server';
import { getTasks } from '@/app/actions/task';
import TaskList from './TaskList';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// Server Component
export default async function TasksPage() {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch tasks
    // This triggers lazy load if empty
    const tasks = await getTasks(user.id);

    return <TaskList initialTasks={tasks} userId={user.id} />;
}
