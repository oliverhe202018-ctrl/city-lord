
'use client';

import { ActivityCard } from './ActivityCard';

export function SinglePlayer() {
  // TODO: Fetch real running records
  const records: any[] = [];

  return (
    <div className="p-4 text-white">
      <h2 className="text-xl font-bold mb-4">个人战绩</h2>
      <div className="space-y-4">
        {records.length > 0 ? (
          records.map((record) => (
            <ActivityCard key={record.id} record={record} />
          ))
        ) : (
          <div className="text-center text-white/50 py-8">暂无战绩记录</div>
        )}
      </div>
    </div>
  );
}
