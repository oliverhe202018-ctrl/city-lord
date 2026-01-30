
'use client';

import { mockRunningRecords } from '@/data/running-records';
import { ActivityCard } from './ActivityCard';

export function SinglePlayer() {
  return (
    <div className="p-4 text-white">
      <h2 className="text-xl font-bold mb-4">个人战绩</h2>
      <div className="space-y-4">
        {mockRunningRecords.map((record) => (
          <ActivityCard key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}
