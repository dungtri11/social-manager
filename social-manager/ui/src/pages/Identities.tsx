import { useEffect, useState } from 'react';
import { accountsApi, identityApi } from '../api';
import type {
  Account,
  IdentityBundle,
  ValidationResult,
  RuleResult,
  RiskEvent,
} from '../types';
import './Identities.css';

export function Identities() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [identities, setIdentities] = useState<Record<string, IdentityBundle>>({});
  const [validations, setValidations] = useState<Record<string, ValidationResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [rules, setRules] = useState<RuleResult[]>([]);

  useEffect(() => {
    loadData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const accountsRes = await accountsApi.getAll();
      setAccounts(accountsRes);

      // Load identities for all accounts
      const identitiesMap: Record<string, IdentityBundle> = {};
      const validationsMap: Record<string, ValidationResult> = {};

      for (const account of accountsRes) {
        try {
          const identityRes = await identityApi.get(account.id);
          if (identityRes.success && identityRes.data) {
            identitiesMap[account.id] = identityRes.data;

            // Also validate
            const validationRes = await identityApi.validate(account.id);
            if (validationRes.success && validationRes.data) {
              validationsMap[account.id] = validationRes.data;
            }
          }
        } catch (err) {
          // Identity might not exist yet, skip
        }
      }

      setIdentities(identitiesMap);
      setValidations(validationsMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load identities');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIdentity(accountId: string) {
    setActionLoading((prev) => ({ ...prev, [accountId]: true }));
    setError(null);

    try {
      const res = await identityApi.create(accountId);
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create identity');
    } finally {
      setActionLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  }

  async function handleValidateIdentity(accountId: string) {
    setActionLoading((prev) => ({ ...prev, [accountId]: true }));
    setError(null);

    try {
      const res = await identityApi.validate(accountId);
      if (res.success) {
        setValidations((prev) => ({ ...prev, [accountId]: res.data }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate identity');
    } finally {
      setActionLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  }

  async function handleShowDetails(accountId: string) {
    setSelectedAccount(accountId);
    setActionLoading((prev) => ({ ...prev, [accountId]: true }));

    try {
      const [eventsRes, rulesRes] = await Promise.all([
        identityApi.getEvents(accountId, 10),
        identityApi.checkRules(accountId),
      ]);

      if (eventsRes.success) {
        setRiskEvents(eventsRes.data);
      }

      if (rulesRes.success) {
        setRules(rulesRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setActionLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  }

  function renderValidationStatus(accountId: string) {
    const validation = validations[accountId];

    if (!validation) {
      return <span className="badge gray">Not Validated</span>;
    }

    const statusColors = {
      VALID: 'green',
      RISKY: 'yellow',
      INVALID: 'red',
    };

    return (
      <span className={`badge ${statusColors[validation.status]}`}>
        {validation.status}
      </span>
    );
  }

  function renderIdentityActions(account: Account) {
    const identity = identities[account.id];
    const isLoading = actionLoading[account.id];

    if (!identity) {
      return (
        <button
          className="btn primary small"
          onClick={() => handleCreateIdentity(account.id)}
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Create Identity'}
        </button>
      );
    }

    return (
      <div className="btn-group">
        <button
          className="btn secondary small"
          onClick={() => handleValidateIdentity(account.id)}
          disabled={isLoading}
        >
          {isLoading ? 'Validating...' : 'Validate'}
        </button>
        <button
          className="btn info small"
          onClick={() => handleShowDetails(account.id)}
          disabled={isLoading}
        >
          Details
        </button>
      </div>
    );
  }

  function closeModal() {
    setSelectedAccount(null);
    setRiskEvents([]);
    setRules([]);
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="identities-page">
      <div className="page-header">
        <h1>Identity Manager</h1>
        <p className="subtitle">Manage account identities and security validation</p>
      </div>

      {error && (
        <div className="alert error">
          <strong>Error:</strong> {error}
          <button className="close-btn" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="identities-table-container">
        <table className="identities-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Identity</th>
              <th>Proxy</th>
              <th>User Agent</th>
              <th>Timezone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const identity = identities[account.id];
              const profile = identity?.profile;
              return (
                <tr key={account.id}>
                  <td>
                    <strong>{account.username}</strong>
                  </td>
                  <td>
                    {identity ? (
                      <span className="badge green">✓ Created</span>
                    ) : (
                      <span className="badge gray">No Identity</span>
                    )}
                  </td>
                  <td>
                    {identity?.proxy ? (
                      <code>
                        {identity.proxy.host}:{identity.proxy.port}
                      </code>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {profile?.userAgent ? (
                      <span className="text-small">
                        {profile.userAgent.substring(0, 40)}...
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {profile?.timezone ? (
                      <span>{profile.timezone}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>{renderValidationStatus(account.id)}</td>
                  <td>{renderIdentityActions(account)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedAccount && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Identity Details</h2>
              <button className="close-btn" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <h3>Rule Checks</h3>
              {rules.length > 0 ? (
                <div className="rules-list">
                  {rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className={`rule-item ${rule.passed ? 'passed' : 'failed'}`}
                    >
                      <div className="rule-header">
                        <span className={`badge ${rule.passed ? 'green' : 'red'}`}>
                          {rule.passed ? '✓' : '✗'}
                        </span>
                        <strong>{rule.rule}</strong>
                        <span className={`severity ${rule.severity.toLowerCase()}`}>
                          {rule.severity}
                        </span>
                      </div>
                      <div className="rule-message">{rule.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No rule checks available</p>
              )}

              <h3>Recent Risk Events</h3>
              {riskEvents.length > 0 ? (
                <div className="events-list">
                  {riskEvents.map((event) => (
                    <div key={event.id} className="event-item">
                      <div className="event-header">
                        <span className={`severity ${event.severity.toLowerCase()}`}>
                          {event.severity}
                        </span>
                        <strong>{event.type.replace(/_/g, ' ')}</strong>
                        <span className="event-time">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {event.metadata && (
                        <div className="event-metadata">
                          <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No recent risk events</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
