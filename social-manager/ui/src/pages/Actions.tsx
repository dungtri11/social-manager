import { useEffect, useState } from 'react';
import { accountsApi, batchApi, schedulesApi } from '../api';
import type { Account, ActionType, BatchResult, ScheduledAction } from '../types';
import './Actions.css';

type ExecutionMode = 'now' | 'schedule';

export function Actions() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [scheduleResult, setScheduleResult] = useState<ScheduledAction | null>(null);

  const [executionMode, setExecutionMode] = useState<ExecutionMode>('now');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [actionType, setActionType] = useState<ActionType>('like');
  const [targetUrl, setTargetUrl] = useState('');
  const [commentText, setCommentText] = useState('');
  const [delayMin, setDelayMin] = useState(5000);
  const [delayMax, setDelayMax] = useState(15000);
  const [submitting, setSubmitting] = useState(false);

  // Schedule-specific fields
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [repeatType, setRepeatType] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('ONCE');
  const [maxRuns, setMaxRuns] = useState<number | ''>('');

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const res = await accountsApi.getAll();
      setAccounts(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map((a) => a.id));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedAccounts.length === 0) {
      setError('Select at least one account');
      return;
    }
    if (!targetUrl) {
      setError('Target URL is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    setScheduleResult(null);

    try {
      const payload = actionType === 'comment' && commentText
        ? { commentTemplate: commentText }
        : undefined;

      if (executionMode === 'now') {
        const res = await batchApi.execute({
          accountIds: selectedAccounts,
          actionType,
          targetUrl,
          payload,
          delayBetweenAccounts: {
            min: delayMin,
            max: delayMax,
          },
        });
        setResult(res);
      } else {
        // Schedule mode
        if (!scheduleName) {
          setError('Schedule name is required');
          setSubmitting(false);
          return;
        }
        if (!scheduleDate || !scheduleTime) {
          setError('Schedule date and time are required');
          setSubmitting(false);
          return;
        }

        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

        const res = await schedulesApi.create({
          name: scheduleName,
          accountIds: selectedAccounts,
          actionType,
          targetUrl,
          payload,
          repeat: repeatType,
          scheduledAt,
          maxRuns: maxRuns !== '' ? maxRuns : undefined,
          delayMin,
          delayMax,
        });
        setScheduleResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute action');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="actions-page">
      <h1>Actions</h1>

      {error && <div className="error-banner">{error}</div>}
      {result && (
        <div className="success-banner">
          Jobs enqueued: {result.jobsEnqueued} / {result.totalAccounts} accounts
          {result.skipped > 0 && ` (${result.skipped} skipped due to risk)`}
        </div>
      )}
      {scheduleResult && (
        <div className="success-banner">
          Schedule "{scheduleResult.name}" created! Scheduled for{' '}
          {new Date(scheduleResult.scheduledAt).toLocaleString()}
          {scheduleResult.repeat !== 'ONCE' && ` (repeats ${scheduleResult.repeat.toLowerCase()})`}
        </div>
      )}

      {/* Execution Mode Tabs */}
      <div className="execution-mode-tabs">
        <button
          className={`mode-tab ${executionMode === 'now' ? 'active' : ''}`}
          onClick={() => setExecutionMode('now')}
          type="button"
        >
          Execute Now
        </button>
        <button
          className={`mode-tab ${executionMode === 'schedule' ? 'active' : ''}`}
          onClick={() => setExecutionMode('schedule')}
          type="button"
        >
          Schedule
        </button>
      </div>

      <form className="action-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>1. Select Accounts</h3>
          <div className="account-selector">
            <label className="select-all">
              <input
                type="checkbox"
                checked={selectedAccounts.length === accounts.length && accounts.length > 0}
                onChange={selectAll}
              />
              Select All ({accounts.length})
            </label>
            <div className="account-list">
              {accounts.map((account) => (
                <label key={account.id} className="account-item">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                  />
                  {account.username}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>2. Configure Action</h3>
          <div className="form-group">
            <label>Action Type</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
            >
              <option value="like">Like</option>
              <option value="comment">Comment</option>
              <option value="share">Share</option>
              <option value="follow">Follow</option>
            </select>
          </div>

          <div className="form-group">
            <label>Target URL *</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://facebook.com/post/..."
              required
            />
          </div>

          {actionType === 'comment' && (
            <div className="form-group">
              <label>Comment Text (supports spin syntax)</label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="{Great|Awesome|Nice} post! {Love it|Thanks for sharing}"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Schedule-specific settings */}
        {executionMode === 'schedule' && (
          <div className="form-section">
            <h3>3. Schedule Settings</h3>
            <div className="form-group">
              <label>Schedule Name *</label>
              <input
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="e.g. Daily like campaign"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Time *</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Repeat</label>
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value as typeof repeatType)}
                >
                  <option value="ONCE">Once</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              {repeatType !== 'ONCE' && (
                <div className="form-group">
                  <label>Max Runs (empty = unlimited)</label>
                  <input
                    type="number"
                    value={maxRuns}
                    onChange={(e) => setMaxRuns(e.target.value ? parseInt(e.target.value) : '')}
                    min={1}
                    placeholder="Unlimited"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-section">
          <h3>{executionMode === 'schedule' ? '4' : '3'}. Delay Settings</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Min Delay (ms)</label>
              <input
                type="number"
                value={delayMin}
                onChange={(e) => setDelayMin(parseInt(e.target.value) || 0)}
                min={1000}
              />
            </div>
            <div className="form-group">
              <label>Max Delay (ms)</label>
              <input
                type="number"
                value={delayMax}
                onChange={(e) => setDelayMax(parseInt(e.target.value) || 0)}
                min={1000}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn primary large" disabled={submitting}>
          {submitting
            ? (executionMode === 'now' ? 'Executing...' : 'Scheduling...')
            : executionMode === 'now'
              ? `Execute ${actionType.toUpperCase()} on ${selectedAccounts.length} accounts`
              : `Schedule ${actionType.toUpperCase()} for ${selectedAccounts.length} accounts`
          }
        </button>
      </form>
    </div>
  );
}
