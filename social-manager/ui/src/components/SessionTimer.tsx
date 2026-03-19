import { useState, useEffect } from 'react';
import './SessionTimer.css';

interface SessionTimerProps {
  expiresAt: string | null;
}

export function SessionTimer({ expiresAt }: SessionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining('—');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeRemaining(`${minutes}m ${seconds}s`);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) {
    return <span className="session-timer-empty">—</span>;
  }

  return (
    <span className="session-timer">
      {timeRemaining}
    </span>
  );
}
