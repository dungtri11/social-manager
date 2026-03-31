import { useEffect, useState } from 'react';
import { schedulesApi } from '../api';
import type { ScheduledAction, ScheduleStatus } from '../types';
import './Schedules.css';

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  ACTIVE: '#059669',
  PAUSED: '#d97706',
  COMPLETED: '#6b7280',
  FAILED: '#dc2626',
};

export function Schedules() {
  const [schedules, setSchedules] = useState<ScheduledAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    loadSchedules();
  }, [filterStatus]);

  async function loadSchedules() {
    try {
      setLoading(true);
      const res = await schedulesApi.getAll(filterStatus || undefined);
      setSchedules(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      await schedulesApi.toggle(id);
      loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete schedule "${name}"?`)) return;
    try {
      await schedulesApi.remove(id);
      loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="schedules-page">
      <div className="page-header">
        <h1>Schedules</h1>
        <div className="filter-bar">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {schedules.length === 0 ? (
        <div className="empty-state">
          <p>No schedules found. Go to <strong>Actions</strong> &rarr; <strong>Schedule</strong> to create one.</p>
        </div>
      ) : (
        <div className="schedules-table-wrapper">
          <table className="schedules-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Action</th>
                <th>Accounts</th>
                <th>Status</th>
                <th>Repeat</th>
                <th>Next Run</th>
                <th>Last Run</th>
                <th>Runs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className="schedule-name">{s.name}</td>
                  <td>
                    <span className="action-badge">{s.actionType}</span>
                  </td>
                  <td>{(s.accountIds as string[]).length}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ background: STATUS_COLORS[s.status] + '18', color: STATUS_COLORS[s.status] }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td>{s.repeat}</td>
                  <td>
                    {s.status === 'COMPLETED' || s.status === 'FAILED'
                      ? '—'
                      : new Date(s.scheduledAt).toLocaleString()
                    }
                  </td>
                  <td>{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : '—'}</td>
                  <td>
                    {s.runCount}
                    {s.maxRuns != null && ` / ${s.maxRuns}`}
                  </td>
                  <td className="actions-cell">
                    {(s.status === 'ACTIVE' || s.status === 'PAUSED') && (
                      <button
                        className={`btn small ${s.status === 'ACTIVE' ? 'warning' : 'primary'}`}
                        onClick={() => handleToggle(s.id)}
                      >
                        {s.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                    <button
                      className="btn small danger"
                      onClick={() => handleDelete(s.id, s.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
