import { useEffect, useState } from 'react';
import { jobsApi } from '../api';
import type { JobDetail } from '../types';
import './JobDetailModal.css';

interface JobDetailModalProps {
  jobId: string;
  onClose: () => void;
}

export function JobDetailModal({ jobId, onClose }: JobDetailModalProps) {
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobDetails();
    const interval = setInterval(loadJobDetails, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [jobId]);

  async function loadJobDetails() {
    try {
      const res = await jobsApi.getDetails(jobId);
      setJobDetail(res.job);
      setError(null);

      // Stop polling if job is completed or failed
      if (res.job.finishedOn) {
        // Will be cleared by cleanup
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    } finally {
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

  function getProgressPercentage() {
    if (!jobDetail?.progress) return 0;
    return jobDetail.progress.progress || 0;
  }

  function getProgressStep() {
    if (!jobDetail?.progress) return 'Waiting...';
    return jobDetail.progress.step.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Job Details</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {loading && !jobDetail ? (
          <div className="modal-body">
            <div className="loading">Loading job details...</div>
          </div>
        ) : error ? (
          <div className="modal-body">
            <div className="error-banner">{error}</div>
          </div>
        ) : jobDetail ? (
          <div className="modal-body">
            <div className="job-info">
              <div className="info-row">
                <span className="label">Job ID:</span>
                <span className="value mono">{jobDetail.id}</span>
              </div>
              <div className="info-row">
                <span className="label">Action:</span>
                <span className={`badge ${jobDetail.data.actionType}`}>
                  {jobDetail.data.actionType}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Account ID:</span>
                <span className="value mono truncate">{jobDetail.data.accountId}</span>
              </div>
              <div className="info-row">
                <span className="label">Target URL:</span>
                <span className="value truncate">{jobDetail.data.targetUrl}</span>
              </div>
              <div className="info-row">
                <span className="label">Created:</span>
                <span className="value">{formatTime(jobDetail.timestamp)}</span>
              </div>
              {jobDetail.processedOn && (
                <div className="info-row">
                  <span className="label">Started:</span>
                  <span className="value">{formatTime(jobDetail.processedOn)}</span>
                </div>
              )}
              {jobDetail.finishedOn && (
                <div className="info-row">
                  <span className="label">Finished:</span>
                  <span className="value">{formatTime(jobDetail.finishedOn)}</span>
                </div>
              )}
              <div className="info-row">
                <span className="label">Attempts:</span>
                <span className="value">{jobDetail.attemptsMade}</span>
              </div>
              {jobDetail.failedReason && (
                <div className="info-row">
                  <span className="label">Error:</span>
                  <span className="value error-text">{jobDetail.failedReason}</span>
                </div>
              )}
            </div>

            {jobDetail.progress && !jobDetail.finishedOn && (
              <div className="progress-section">
                <div className="progress-header">
                  <span className="progress-label">{getProgressStep()}</span>
                  <span className="progress-percent">{getProgressPercentage()}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>
            )}

            <div className="logs-section">
              <h3>Activity Logs</h3>
              <div className="logs-container">
                {jobDetail.logs.logs.length === 0 ? (
                  <div className="no-logs">No logs yet...</div>
                ) : (
                  jobDetail.logs.logs.map((log, index) => (
                    <div key={index} className="log-entry">
                      <span className="log-message">{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {jobDetail.returnvalue && (
              <div className="result-section">
                <h3>Result</h3>
                <pre className="result-data">
                  {JSON.stringify(jobDetail.returnvalue, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
