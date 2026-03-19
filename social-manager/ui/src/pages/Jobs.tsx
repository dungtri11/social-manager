import { useEffect, useState } from 'react';
import { jobsApi } from '../api';
import type { Job, JobStats, JobStatus } from '../types';
import { JobDetailModal } from '../components/JobDetailModal';
import './Jobs.css';

export function Jobs() {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<JobStatus>('waiting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // Reduced frequency: 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadJobs(activeTab);
    // Only poll active/waiting tabs frequently; completed/failed rarely change
    const pollInterval = (activeTab === 'waiting' || activeTab === 'active') ? 5000 : 30000;
    const interval = setInterval(() => loadJobs(activeTab), pollInterval);
    return () => clearInterval(interval);
  }, [activeTab]);

  async function loadStats() {
    try {
      const res = await jobsApi.getStats();
      // Only update if stats actually changed
      setStats((prev) => {
        if (!prev || JSON.stringify(prev) !== JSON.stringify(res.stats)) {
          return res.stats;
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async function loadJobs(status: JobStatus) {
    try {
      const res = await jobsApi.getByStatus(status);
      // Only update if jobs actually changed
      setJobs((prev) => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(res.jobs);
        if (hasChanged) {
          setLoading(false);
          return res.jobs;
        }
        return prev;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setLoading(false);
    }
  }

  function formatTime(timestamp: number | undefined) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
  }

  function formatLogTime(timestamp: number | undefined) {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp);
      // Check for Invalid Date
      if (isNaN(date.getTime())) {
        return `[Invalid: ${timestamp}]`;
      }
      return date.toLocaleTimeString();
    } catch (e) {
      return `[Error parsing: ${timestamp}]`;
    }
  }

  function getProgressPercentage(job: Job) {
    if (!job.progress) return 0;
    return job.progress.progress || 0;
  }

  function getProgressStep(job: Job) {
    if (!job.progress) return '-';
    return job.progress.step.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function getRecentLogs(job: Job, limit = 5) {
    if (!job.logs || !job.logs.logs || job.logs.logs.length === 0) {
      return [];
    }
    // Return the last N log entries (most recent)
    return job.logs.logs.slice(-limit);
  }

  const tabs: { status: JobStatus; label: string }[] = [
    { status: 'waiting', label: 'Waiting' },
    { status: 'active', label: 'Active' },
    { status: 'completed', label: 'Completed' },
    { status: 'failed', label: 'Failed' },
  ];

  return (
    <div className="jobs-page">
      <h1>Jobs Queue</h1>

      {stats && (
        <div className="stats-row">
          <div className="stat">
            <span className="value">{stats.waiting}</span>
            <span className="label">Waiting</span>
          </div>
          <div className="stat">
            <span className="value">{stats.active}</span>
            <span className="label">Active</span>
          </div>
          <div className="stat">
            <span className="value">{stats.completed}</span>
            <span className="label">Completed</span>
          </div>
          <div className="stat error">
            <span className="value">{stats.failed}</span>
            <span className="label">Failed</span>
          </div>
        </div>
      )}

      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            className={`tab ${activeTab === tab.status ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.status)}
          >
            {tab.label}
            {stats && <span className="count">{stats[tab.status]}</span>}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="jobs-list">
        {loading ? (
          <div className="loading">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="empty">No {activeTab} jobs</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Action</th>
                <th>Account ID</th>
                <th>Target URL</th>
                {activeTab === 'active' && <th>Progress</th>}
                {(activeTab === 'active' || activeTab === 'completed' || activeTab === 'failed') && (
                  <th>Recent Activity</th>
                )}
                <th>Created</th>
                {activeTab === 'completed' && <th>Finished</th>}
                {activeTab === 'failed' && <th>Error</th>}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="clickable-row"
                  onClick={() => setSelectedJobId(job.id as string)}
                >
                  <td className="mono">{job.id}</td>
                  <td>
                    <span className={`badge ${job.data.actionType}`}>
                      {job.data.actionType}
                    </span>
                  </td>
                  <td className="mono truncate">{job.data.accountId}</td>
                  <td className="truncate">{job.data.targetUrl}</td>
                  {activeTab === 'active' && (
                    <td>
                      <div className="progress-cell">
                        <span className="progress-text">{getProgressStep(job)}</span>
                        <div className="mini-progress-bar">
                          <div
                            className="mini-progress-fill"
                            style={{ width: `${getProgressPercentage(job)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  )}
                  {(activeTab === 'active' || activeTab === 'completed' || activeTab === 'failed') && (
                    <td>
                      <div className="logs-inline">
                        {getRecentLogs(job).length === 0 ? (
                          <div className="no-logs-inline">No activity yet</div>
                        ) : (
                          getRecentLogs(job).map((log, index) => (
                            <div key={index} className="log-entry-inline">
                              <span className="log-message-inline">{log}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  )}
                  <td>{formatTime(job.timestamp)}</td>
                  {activeTab === 'completed' && <td>{formatTime(job.finishedOn)}</td>}
                  {activeTab === 'failed' && (
                    <td className="error-text">{job.failedReason || '-'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedJobId && (
        <JobDetailModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
