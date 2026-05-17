import { useEffect, useRef } from 'react';
import { isNativePlatform, safeAppAddListener, safeBackgroundTaskBeforeExit, safeBackgroundTaskFinish } from "@/lib/capacitor/safe-plugins";


export const useBackgroundLocation = () => {
  const taskIdRef = useRef<string | null>(null);

  useEffect(() => {
    let listenerPromise: Promise<any> | null = null;

    const onAppStateChange = async (state: any) => {
      if (!state.isActive) {
        // App goes to background
        console.log('App entered background, requesting background task...');
        
        try {
          const taskId = await safeBackgroundTaskBeforeExit(async () => {
            console.log('Background task executing. Geolocation should stay alive.');
            
            // Here we don't actually need to do heavy work, 
            // just requesting the task tells OS "we are busy".
            // The Geolocation.watchPosition in other components will continue 
            // as long as the app process is alive.
            
            // We will finish this task only when app resumes or system kills us
          });
          
          if (taskId) taskIdRef.current = taskId;
        } catch (err) {
          console.error('Failed to start background task:', err);
        }
      } else {
        // App resumes
        if (taskIdRef.current) {
          console.log('App resumed, finishing background task:', taskIdRef.current);
          safeBackgroundTaskFinish(taskIdRef.current);
          taskIdRef.current = null;
        }
      }
    };

    const setup = async () => {
      if (!(await isNativePlatform())) return;
      listenerPromise = safeAppAddListener('appStateChange', onAppStateChange);
    };

    setup();

    return () => {
      if (listenerPromise) {
        listenerPromise.then(l => l?.remove());
      }
      if (taskIdRef.current) {
        safeBackgroundTaskFinish(taskIdRef.current);
      }
    };
  }, []);

};
