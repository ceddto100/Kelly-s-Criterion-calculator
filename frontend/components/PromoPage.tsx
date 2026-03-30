import React, { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

interface Promo {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  date: string;
}

interface PromoPageProps {
  user: { name?: string; email?: string; avatar?: string } | null;
}

const ADMIN_EMAIL = 'cartercedrick35@gmail.com';
const normalizeEmail = (value?: string) => value?.trim().toLowerCase() ?? '';

export const PromoPage: React.FC<PromoPageProps> = ({ user }) => {
  // Check if current user is admin
  const isAdmin = normalizeEmail(user?.email) === ADMIN_EMAIL;
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [promos, setPromos] = useState<Promo[]>([
    {
      id: '1',
      title: 'Welcome Bonus - DraftKings',
      description: 'Get up to $1,000 in bonus bets on your first deposit',
      url: 'https://draftkings.com',
      imageUrl: '',
      date: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'FanDuel Sportsbook Promo',
      description: 'Bet $5, Get $150 in bonus bets',
      url: 'https://fanduel.com',
      imageUrl: '',
      date: new Date().toISOString(),
    },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newPromo, setNewPromo] = useState({
    title: '',
    description: '',
    url: '',
    imageUrl: '',
  });

  const handleAddPromo = () => {
    if (!newPromo.title || !newPromo.url) {
      alert('Please fill in at least the title and URL');
      return;
    }

    const promo: Promo = {
      id: Date.now().toString(),
      title: newPromo.title,
      description: newPromo.description,
      url: newPromo.url,
      imageUrl: newPromo.imageUrl,
      date: new Date().toISOString(),
    };

    setPromos([promo, ...promos]);
    setNewPromo({ title: '', description: '', url: '', imageUrl: '' });
    setShowAddForm(false);
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
    } catch (error) {
      setResetStatus('error');
      setResetMessage('Unable to reset free calculations.');
    }
  };

  const handleDeletePromo = (id: string) => {
    if (confirm('Are you sure you want to delete this promo?')) {
      setPromos(promos.filter((p) => p.id !== id));
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
    <div className="p-5 max-w-6xl mx-auto pb-24">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2.5 accent-gradient-text">🎁 Promotions & Links</h2>
        <p className="text-base text-[var(--text-secondary)]">
          Exclusive offers and promotional links for sports betting
        </p>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-4 mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-accent self-start"
          >
            {showAddForm ? '✕ Cancel' : '➕ Add New Promo'}
          </button>
          <div className="glass-card p-5 flex flex-col gap-3">
            <div>
              <div className="text-base font-bold text-[var(--text-primary)]">Reset Free Probability Checks</div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                Clears monthly free calculations for all free-tier users.
              </div>
            </div>
            <button
              onClick={handleResetFreeCalculations}
              className="self-start px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-br from-orange-500 to-red-500 border-none rounded-xl cursor-pointer shadow-lg"
              disabled={resetStatus === 'loading'}
            >
              {resetStatus === 'loading' ? 'Resetting...' : 'Master Reset'}
            </button>
            {resetMessage && (
              <div className={`text-[13px] font-semibold ${resetStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {resetMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="glass-card p-6 mb-8">
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-5">Add New Promotion</h3>
          <input
            type="text"
            placeholder="Promo Title *"
            value={newPromo.title}
            onChange={(e) =>
              setNewPromo({ ...newPromo, title: e.target.value })
            }
            className="input-field mb-4"
          />
          <textarea
            placeholder="Description"
            value={newPromo.description}
            onChange={(e) =>
              setNewPromo({ ...newPromo, description: e.target.value })
            }
            className="input-field mb-4 min-h-[80px] resize-y font-[inherit]"
          />
          <input
            type="url"
            placeholder="Promo URL *"
            value={newPromo.url}
            onChange={(e) => setNewPromo({ ...newPromo, url: e.target.value })}
            className="input-field mb-4"
          />
          <input
            type="url"
            placeholder="Image URL (optional)"
            value={newPromo.imageUrl}
            onChange={(e) =>
              setNewPromo({ ...newPromo, imageUrl: e.target.value })
            }
            className="input-field mb-4"
          />
          <button onClick={handleAddPromo} className="btn-accent bg-gradient-to-br from-emerald-500 to-emerald-600">
            Add Promotion
          </button>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
        {promos.length === 0 ? (
          <div className="text-center py-16 px-5 col-span-full">
            <div className="text-6xl mb-5">📭</div>
            <p className="text-lg text-[var(--text-primary)] mb-2.5">No promotions yet</p>
            {isAdmin && (
              <p className="text-sm text-[var(--text-secondary)]">
                Click "Add New Promo" to get started
              </p>
            )}
          </div>
        ) : (
          promos.map((promo) => (
            <div key={promo.id} className="glass-card overflow-hidden">
              {promo.imageUrl && (
                <div className="w-full h-[150px] overflow-hidden bg-white/5">
                  <img
                    src={promo.imageUrl}
                    alt={promo.title}
                    title={promo.title}
                    className="w-full h-full object-cover"
                    width="100%"
                    height="auto"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex justify-between items-start mb-2.5 gap-2.5">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] flex-1">{promo.title}</h3>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{formatDate(promo.date)}</span>
                </div>
                {promo.description && (
                  <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{promo.description}</p>
                )}
                <div className="flex gap-2.5 items-center">
                  <a
                    href={promo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent flex-1 inline-flex items-center justify-center gap-1.5 no-underline text-sm"
                  >
                    🔗 Visit Link
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeletePromo(promo.id)}
                      className="btn-danger px-4 py-2.5"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {user && !isAdmin && (
        <div className="mt-8 p-5 bg-[var(--accent-muted)] rounded-xl border border-[var(--accent)]/30 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Only the site administrator can add and manage promotional links
          </p>
        </div>
      )}
    </div>
  );
};
