import { useEffect, useState } from 'react';
import { accountsApi, batchApi } from '../api';
import type { Account, ActionType, BatchResult } from '../types';
import './Actions.css';

export function Actions() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [actionType, setActionType] = useState<ActionType>('like');
  const [targetUrl, setTargetUrl] = useState('');
  const [commentText, setCommentText] = useState('');
  const [delayMin, setDelayMin] = useState(5000);
  const [delayMax, setDelayMax] = useState(15000);
  const [submitting, setSubmitting] = useState(false);

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

    try {
      const payload = actionType === 'comment' && commentText
        ? { commentTemplate: commentText }
        : undefined;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute action');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="actions-page">
      <h1>Execute Actions</h1>

      {error && <div className="error-banner">{error}</div>}
      {result && (
        <div className="success-banner">
          Jobs enqueued: {result.jobsEnqueued} / {result.totalAccounts} accounts
          {result.skipped > 0 && ` (${result.skipped} skipped due to risk)`}
        </div>
      )}

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

        <div className="form-section">
          <h3>3. Delay Settings</h3>
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
          {submitting ? 'Executing...' : `Execute ${actionType.toUpperCase()} on ${selectedAccounts.length} accounts`}
        </button>
      </form>
    </div>
  );
}
