import { getMissions } from '@/app/actions/mission';
import MissionList from './MissionList';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const missions = await getMissions();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <MissionList initialMissions={missions} />
    </div>
  );
}
