import { SessionStatus } from '../types';
import './SessionStatusBadge.css';

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const getClassName = () => {
    switch (status) {
      case SessionStatus.LOGGED_IN:
        return 'session-badge session-logged-in';
      case SessionStatus.EXPIRED:
        return 'session-badge session-expired';
      case SessionStatus.LOGGED_OUT:
        return 'session-badge session-logged-out';
      default:
        return 'session-badge';
    }
  };

  const getLabel = () => {
    switch (status) {
      case SessionStatus.LOGGED_IN:
        return 'Logged In';
      case SessionStatus.EXPIRED:
        return 'Expired';
      case SessionStatus.LOGGED_OUT:
        return 'Logged Out';
      default:
        return status;
    }
  };

  return (
    <span className={getClassName()}>
      {getLabel()}
    </span>
  );
}
