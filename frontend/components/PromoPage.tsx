import React, { useEffect, useMemo, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

type MediaType = 'link' | 'youtube' | 'vimeo' | 'iframe' | 'pdf' | 'ebook';

interface Promo {
  _id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  embedUrl: string;
  ctaUrl: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface PromoPageProps {
  user: { name?: string; email?: string; avatar?: string } | null;
}

interface PromoDraft {
  title: string;
  description: string;
  mediaType: MediaType;
  embedUrl: string;
  ctaUrl: string;
  imageUrl: string;
}

const ADMIN_EMAIL = 'cartercedrick35@gmail.com';
const normalizeEmail = (value?: string) => value?.trim().toLowerCase() ?? '';

const INITIAL_DRAFT: PromoDraft = {
  title: '',
  description: '',
  mediaType: 'link',
  embedUrl: '',
  ctaUrl: '',
  imageUrl: '',
};

const MEDIA_OPTIONS: Array<{ value: MediaType; label: string; hint: string }> = [
  { value: 'link', label: 'Link only', hint: 'External page with no inline embed' },
  { value: 'youtube', label: 'YouTube', hint: 'Video via youtube.com or youtu.be URL' },
  { value: 'vimeo', label: 'Vimeo', hint: 'Video via Vimeo URL' },
  { value: 'iframe', label: 'Custom iframe', hint: 'Paste provider embed URL (not raw HTML)' },
  { value: 'pdf', label: 'PDF / e-book file', hint: 'Embed a PDF URL' },
  { value: 'ebook', label: 'e-Book platform', hint: 'Use provider embed URL or fallback button link' },
];

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '') || null;
    }
    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v');
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

function extractVimeoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1] || '';
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function resolveEmbedUrl(promo: Promo): string {
  if (!promo.embedUrl) return '';

  if (promo.mediaType === 'youtube') {
    const id = extractYouTubeId(promo.embedUrl);
    return id ? `https://www.youtube.com/embed/${id}` : '';
  }

  if (promo.mediaType === 'vimeo') {
    const id = extractVimeoId(promo.embedUrl);
    return id ? `https://player.vimeo.com/video/${id}` : '';
  }

  return promo.embedUrl;
}

export const PromoPage: React.FC<PromoPageProps> = ({ user }) => {
  const isAdmin = normalizeEmail(user?.email) === ADMIN_EMAIL;

  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [promos, setPromos] = useState<Promo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [submittingPromo, setSubmittingPromo] = useState(false);
  const [newPromo, setNewPromo] = useState<PromoDraft>(INITIAL_DRAFT);

  const requiresEmbedUrl = useMemo(
    () => newPromo.mediaType !== 'link',
    [newPromo.mediaType]
  );

  const loadPromos = async () => {
    setLoadingPromos(true);
    setPromoError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/promos`);
      if (!response.ok) {
        throw new Error('Unable to load promos');
      }

      const data = await response.json();
      setPromos(Array.isArray(data.promos) ? data.promos : []);
    } catch {
      setPromoError('Could not load promo embeds right now.');
    } finally {
      setLoadingPromos(false);
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleAddPromo = async () => {
    if (!newPromo.title.trim()) {
      alert('Please add a title');
      return;
    }

    if (requiresEmbedUrl && !newPromo.embedUrl.trim()) {
      alert('This media type needs an embed URL');
      return;
    }

    if (!newPromo.embedUrl.trim() && !newPromo.ctaUrl.trim()) {
      alert('Please provide at least one URL (embed URL or button URL)');
      return;
    }

    setSubmittingPromo(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/promos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPromo),
      });

      if (!response.ok) {
        throw new Error('Unable to save promo');
      }

      setNewPromo(INITIAL_DRAFT);
      setShowAddForm(false);
      await loadPromos();
    } catch {
      alert('Unable to save promo right now.');
    } finally {
      setSubmittingPromo(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/promos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setPromos((prev) => prev.filter((p) => p._id !== id));
    } catch {
      alert('Unable to delete this item right now.');
    }
  };

  const handleResetFreeCalculations = async () => {
    setResetStatus('loading');
    setResetMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/reset-free-calculations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Reset failed');
      }

      const data = await response.json();
      setResetStatus('success');
      setResetMessage(`Reset free calculations for ${data.modified} users.`);
    } catch {
      setResetStatus('error');
      setResetMessage('Unable to reset free calculations.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🎬 Media & Promotions</h2>
        <p style={styles.subtitle}>
          Admin-controlled embeds for trailers, videos, PDF e-books, and external platforms (including future 11Reader embeds)
        </p>
      </div>

      {isAdmin && (
        <div style={styles.adminActions}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={styles.addButton}
          >
            {showAddForm ? '✕ Cancel' : '➕ Add Media Item'}
          </button>
          <div style={styles.resetCard}>
            <div>
              <div style={styles.resetTitle}>Reset Free Probability Checks</div>
              <div style={styles.resetDescription}>
                Clears monthly free calculations for all free-tier users.
              </div>
            </div>
            <button
              onClick={handleResetFreeCalculations}
              style={styles.resetButton}
              disabled={resetStatus === 'loading'}
            >
              {resetStatus === 'loading' ? 'Resetting...' : 'Master Reset'}
            </button>
            {resetMessage && (
              <div style={{
                ...styles.resetMessage,
                color: resetStatus === 'success' ? '#4ade80' : '#f87171'
              }}>
                {resetMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddForm && (
        <div style={styles.addForm}>
          <h3 style={styles.formTitle}>Create Embedded Media Item</h3>
          <input
            type="text"
            placeholder="Title *"
            value={newPromo.title}
            onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
            style={styles.input}
          />
          <textarea
            placeholder="Description"
            value={newPromo.description}
            onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
            style={{ ...styles.input, ...styles.textarea }}
          />

          <label style={styles.label}>Media Type</label>
          <select
            value={newPromo.mediaType}
            onChange={(e) => setNewPromo({ ...newPromo, mediaType: e.target.value as MediaType })}
            style={styles.input}
          >
            {MEDIA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.hint}
              </option>
            ))}
          </select>

          <input
            type="url"
            placeholder={requiresEmbedUrl ? 'Embed URL *' : 'Embed URL (optional)'}
            value={newPromo.embedUrl}
            onChange={(e) => setNewPromo({ ...newPromo, embedUrl: e.target.value })}
            style={styles.input}
          />
          <input
            type="url"
            placeholder="Button URL (optional fallback or CTA)"
            value={newPromo.ctaUrl}
            onChange={(e) => setNewPromo({ ...newPromo, ctaUrl: e.target.value })}
            style={styles.input}
          />
          <input
            type="url"
            placeholder="Thumbnail Image URL (optional)"
            value={newPromo.imageUrl}
            onChange={(e) => setNewPromo({ ...newPromo, imageUrl: e.target.value })}
            style={styles.input}
          />

          <button onClick={handleAddPromo} style={styles.submitButton} disabled={submittingPromo}>
            {submittingPromo ? 'Saving...' : 'Save Media Item'}
          </button>
        </div>
      )}

      {promoError && <div style={styles.errorBanner}>{promoError}</div>}

      <div style={styles.promoGrid}>
        {loadingPromos ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>Loading media items…</p>
          </div>
        ) : promos.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <p style={styles.emptyText}>No media items yet</p>
            {isAdmin && (
              <p style={styles.emptySubtext}>
                Add your trailer, e-book, or platform embed from the admin form.
              </p>
            )}
          </div>
        ) : (
          promos.map((promo) => {
            const embedSrc = resolveEmbedUrl(promo);
            return (
              <div key={promo._id} style={styles.promoCard}>
                {promo.imageUrl && (
                  <div style={styles.promoImageContainer}>
                    <img
                      src={promo.imageUrl}
                      alt={promo.title}
                      title={promo.title}
                      style={styles.promoImage}
                      width="100%"
                      height="auto"
                      loading="lazy"
                    />
                  </div>
                )}

                {embedSrc && promo.mediaType !== 'link' && (
                  <div style={styles.embedContainer}>
                    <iframe
                      src={embedSrc}
                      title={`${promo.title} embed`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      referrerPolicy="strict-origin-when-cross-origin"
                      style={styles.iframe}
                    />
                  </div>
                )}

                <div style={styles.promoContent}>
                  <div style={styles.promoHeader}>
                    <h3 style={styles.promoTitle}>{promo.title}</h3>
                    <span style={styles.promoDate}>{formatDate(promo.createdAt)}</span>
                  </div>
                  {promo.description && (
                    <p style={styles.promoDescription}>{promo.description}</p>
                  )}
                  <div style={styles.badge}>{promo.mediaType.toUpperCase()}</div>
                  <div style={styles.promoActions}>
                    {(promo.ctaUrl || promo.embedUrl) && (
                      <a
                        href={promo.ctaUrl || promo.embedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.promoLink}
                      >
                        🔗 Open
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePromo(promo._id)}
                        style={styles.deleteButton}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {user && !isAdmin && (
        <div style={styles.loginPrompt}>
          <p style={styles.loginText}>
            Only the site administrator can add and manage media embeds.
          </p>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    paddingBottom: '100px',
  },
  header: {
    marginBottom: '30px',
  },
  adminActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    background: 'var(--accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  addButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
  },
  resetCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '18px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(15, 23, 42, 0.6)',
    color: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.35)',
  },
  resetTitle: {
    fontSize: '16px',
    fontWeight: '700',
  },
  resetDescription: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  resetButton: {
    alignSelf: 'flex-start',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#fff',
    background: 'linear-gradient(135deg, #f97316, #ef4444)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)',
  },
  resetMessage: {
    fontSize: '13px',
    fontWeight: '600',
  },
  addForm: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '25px',
    marginBottom: '30px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '13px',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    marginBottom: '15px',
    fontSize: '14px',
    color: 'white',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  submitButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
  },
  errorBanner: {
    background: 'rgba(248, 113, 113, 0.15)',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    color: '#fecaca',
    padding: '12px 14px',
    borderRadius: '12px',
    marginBottom: '18px',
  },
  promoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  promoCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  promoImageContainer: {
    width: '100%',
    height: '150px',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.05)',
  },
  promoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  embedContainer: {
    width: '100%',
    aspectRatio: '16 / 9',
    background: 'rgba(0, 0, 0, 0.45)',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  promoContent: {
    padding: '20px',
  },
  promoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
    gap: '10px',
  },
  promoTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  promoDate: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    whiteSpace: 'nowrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '11px',
    letterSpacing: '0.08em',
    fontWeight: 700,
    color: '#22d3ee',
    background: 'rgba(34, 211, 238, 0.12)',
    border: '1px solid rgba(34, 211, 238, 0.35)',
    borderRadius: '999px',
    padding: '5px 10px',
  },
  promoDescription: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '15px',
    lineHeight: '1.5',
  },
  promoActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  promoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    background: 'var(--accent-gradient)',
    textDecoration: 'none',
    borderRadius: '10px',
    flex: 1,
    justifyContent: 'center',
  },
  deleteButton: {
    padding: '10px 15px',
    fontSize: '16px',
    background: 'rgba(239, 68, 68, 0.8)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    gridColumn: '1 / -1',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  emptyText: {
    fontSize: '18px',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '10px',
  },
  emptySubtext: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  loginPrompt: {
    marginTop: '30px',
    padding: '20px',
    background: 'rgba(168, 85, 247, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    textAlign: 'center',
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px',
  },
};
