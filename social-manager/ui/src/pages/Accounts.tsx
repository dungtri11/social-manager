import { useEffect, useState } from 'react';
import { accountsApi, proxiesApi } from '../api';
import type { Account, Proxy, CreateAccountPayload } from '../types';
import './Accounts.css';

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateAccountPayload>({
    username: '',
    cookie: '',
    userAgent: navigator.userAgent,
    proxyId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [accountEvents, setAccountEvents] = useState<Record<string, { behavior: string; status: 'idle' | 'processing' }>>({});

  useEffect(() => {
    loadData();

    // Auto-refresh every 30 seconds to update session timers
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const evtSource = new EventSource('/api/accounts/events/stream');

    evtSource.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.type === 'init') {
        setAccountEvents(data.states ?? {});
      } else if (data.type === 'update') {
        const { accountId, behavior, status } = data;
        setAccountEvents((prev) => ({ ...prev, [accountId]: { behavior, status } }));
      }
    };

    return () => evtSource.close();
  }, []);

  async function loadData() {
    try {
      const [accountsRes, proxiesRes] = await Promise.all([
        accountsApi.getAll(),
        proxiesApi.getAll(),
      ]);
      setAccounts(accountsRes);
      setProxies(proxiesRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        cookie: formData.cookie || undefined,
        proxyId: formData.proxyId || undefined,
      };
      await accountsApi.create(payload);
      setShowForm(false);
      setFormData({ username: '', cookie: '', userAgent: navigator.userAgent, proxyId: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(accountId: string) {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, [accountId]: true }));
    setError(null);

    try {
      await accountsApi.delete(accountId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  }

  function renderSessionActions(account: Account) {
    const isLoading = actionLoading[account.id];

    return (
      <button
        className="btn danger small"
        onClick={() => handleDelete(account.id)}
        disabled={isLoading}
      >
        {isLoading ? 'Deleting...' : 'Delete'}
      </button>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="accounts-page">
      <header className="page-header">
        <h1>Accounts</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Account'}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="Account username"
            />
          </div>
          <div className="form-group">
            <label>Cookie (optional - can login later)</label>
            <textarea
              value={formData.cookie}
              onChange={(e) => setFormData({ ...formData, cookie: e.target.value })}
              placeholder="Paste cookie string here or leave empty and login later"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>User Agent *</label>
            <input
              type="text"
              value={formData.userAgent}
              onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Proxy (optional)</label>
            <select
              value={formData.proxyId}
              onChange={(e) => setFormData({ ...formData, proxyId: e.target.value })}
            >
              <option value="">No proxy</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.host}:{proxy.port}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      <div className="accounts-list">
        {accounts.length === 0 ? (
          <p className="empty">No accounts found. Add one to get started.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Status</th>
                <th>Behavior</th>
                <th>Proxy</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const evt = accountEvents[account.id];
                const status = evt?.status ?? 'idle';
                const behavior = evt?.behavior ?? '';
                return (
                  <tr key={account.id}>
                    <td><strong>{account.username}</strong></td>
                    <td>
                      <span className={`status-badge ${status}`}>
                        {status === 'processing' ? 'Processing' : 'Idle'}
                      </span>
                    </td>
                    <td className="behavior-cell">
                      {behavior || <span className="behavior-empty">—</span>}
                    </td>
                    <td>{account.proxy ? `${account.proxy.host}:${account.proxy.port}` : '-'}</td>
                    <td className="actions-cell">
                      {renderSessionActions(account)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
