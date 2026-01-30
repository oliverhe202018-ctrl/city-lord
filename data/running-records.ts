
export interface RunningRecord {
  id: string;
  date: string;
  distance: number; // in km
  duration: string; // format: HH:MM:SS
  pace: string; // format: MM'SS"
  hexesCaptured: number;
}

export const mockRunningRecords: RunningRecord[] = [
  {
    id: 'rec-1',
    date: '2025年1月26日',
    distance: 5.2,
    duration: '00:28:45',
    pace: '5\'32"',
    hexesCaptured: 12,
  },
  {
    id: 'rec-2',
    date: '2025年1月24日',
    distance: 3.1,
    duration: '00:16:20',
    pace: '5\'16"',
    hexesCaptured: 7,
  },
  {
    id: 'rec-3',
    date: '2025年1月22日',
    distance: 10.0,
    duration: '01:02:10',
    pace: '6\'13"',
    hexesCaptured: 25,
  },
    {
    id: 'rec-4',
    date: '2025年1月20日',
    distance: 7.5,
    duration: '00:41:50',
    pace: '5\'34"',
    hexesCaptured: 18,
  },
];
