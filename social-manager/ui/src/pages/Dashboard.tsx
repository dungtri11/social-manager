import { useEffect, useState } from 'react';
import { jobsApi, accountsApi } from '../api';
import type { JobStats, Account } from '../types';
import './Dashboard.css';

export function Dashboard() {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [statsRes, accountsRes] = await Promise.all([
        jobsApi.getStats(),
        accountsApi.getAll(),
      ]);
      setStats(statsRes.stats);
      setAccounts(accountsRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{accounts.length}</span>
          <span className="stat-label">Total Accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.waiting || 0}</span>
          <span className="stat-label">Jobs Waiting</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.active || 0}</span>
          <span className="stat-label">Jobs Active</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.completed || 0}</span>
          <span className="stat-label">Jobs Completed</span>
        </div>
        <div className="stat-card error">
          <span className="stat-value">{stats?.failed || 0}</span>
          <span className="stat-label">Jobs Failed</span>
        </div>
      </div>

      <section className="recent-accounts">
        <h2>Recent Accounts</h2>
        {accounts.length === 0 ? (
          <p className="empty">No accounts yet. Add one from the Accounts page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Proxy</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.slice(0, 5).map((account) => (
                <tr key={account.id}>
                  <td>{account.username}</td>
                  <td>{account.proxy ? `${account.proxy.host}:${account.proxy.port}` : '-'}</td>
                  <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
