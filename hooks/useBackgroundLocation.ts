import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { Capacitor } from '@capacitor/core';

export const useBackgroundLocation = () => {
  const taskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onAppStateChange = async (state: any) => {
      if (!state.isActive) {
        // App goes to background
        console.log('App entered background, requesting background task...');
        
        try {
          const taskId = await BackgroundTask.beforeExit(async () => {
            console.log('Background task executing. Geolocation should stay alive.');
            
            // Here we don't actually need to do heavy work, 
            // just requesting the task tells OS "we are busy".
            // The Geolocation.watchPosition in other components will continue 
            // as long as the app process is alive.
            
            // We will finish this task only when app resumes or system kills us
          });
          
          taskIdRef.current = taskId;
        } catch (err) {
          console.error('Failed to start background task:', err);
        }
      } else {
        // App resumes
        if (taskIdRef.current) {
          console.log('App resumed, finishing background task:', taskIdRef.current);
          BackgroundTask.finish({ taskId: taskIdRef.current });
          taskIdRef.current = null;
        }
      }
    };

    const listener = App.addListener('appStateChange', onAppStateChange);

    return () => {
      listener.then(l => l.remove());
      if (taskIdRef.current) {
        BackgroundTask.finish({ taskId: taskIdRef.current });
      }
    };
  }, []);
};
