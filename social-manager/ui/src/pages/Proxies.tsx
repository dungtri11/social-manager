import { useEffect, useState } from 'react';
import { proxiesApi } from '../api';
import type { Proxy, CreateProxyPayload } from '../types';
import './Proxies.css';

export function Proxies() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateProxyPayload>({
    host: '',
    port: 0,
    username: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await proxiesApi.getAll();
      setProxies(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proxies');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: CreateProxyPayload = {
        host: formData.host,
        port: Number(formData.port),
        username: formData.username || undefined,
        password: formData.password || undefined,
      };
      await proxiesApi.create(payload);
      setShowForm(false);
      setFormData({ host: '', port: 0, username: '', password: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proxy');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="proxies-page">
      <header className="page-header">
        <h1>Proxies</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Proxy'}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Host *</label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
                placeholder="proxy.example.com"
              />
            </div>
            <div className="form-group small">
              <label>Port *</label>
              <input
                type="number"
                value={formData.port || ''}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
                required
                placeholder="8080"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Username (optional)</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="proxy username"
              />
            </div>
            <div className="form-group">
              <label>Password (optional)</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="proxy password"
              />
            </div>
          </div>
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Proxy'}
          </button>
        </form>
      )}

      <div className="proxies-list">
        {proxies.length === 0 ? (
          <p className="empty">No proxies found. Add one to get started.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Host</th>
                <th>Port</th>
                <th>Auth</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => (
                <tr key={proxy.id}>
                  <td><strong>{proxy.host}</strong></td>
                  <td>{proxy.port}</td>
                  <td>{proxy.username ? 'Yes' : 'No'}</td>
                  <td>{new Date(proxy.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
