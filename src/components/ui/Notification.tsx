'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import clsx from 'clsx';

export function Notification() {
  const notification = useAppStore((state) => state.notification);
  const clearNotification = useAppStore((state) => state.clearNotification);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  return (
    <div
      className={clsx(
        'notification',
        notification && 'show',
        notification?.type
      )}
    >
      {notification?.message}
    </div>
  );
}
