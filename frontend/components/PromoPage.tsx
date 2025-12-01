import React, { useState } from 'react';

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

export const PromoPage: React.FC<PromoPageProps> = ({ user }) => {
  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

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
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🎁 Promotions & Links</h2>
        <p style={styles.subtitle}>
          Exclusive offers and promotional links for sports betting
        </p>
      </div>

      {isAdmin && (
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={styles.addButton}
        >
          {showAddForm ? '✕ Cancel' : '➕ Add New Promo'}
        </button>
      )}

      {showAddForm && (
        <div style={styles.addForm}>
          <h3 style={styles.formTitle}>Add New Promotion</h3>
          <input
            type="text"
            placeholder="Promo Title *"
            value={newPromo.title}
            onChange={(e) =>
              setNewPromo({ ...newPromo, title: e.target.value })
            }
            style={styles.input}
          />
          <textarea
            placeholder="Description"
            value={newPromo.description}
            onChange={(e) =>
              setNewPromo({ ...newPromo, description: e.target.value })
            }
            style={{ ...styles.input, ...styles.textarea }}
          />
          <input
            type="url"
            placeholder="Promo URL *"
            value={newPromo.url}
            onChange={(e) => setNewPromo({ ...newPromo, url: e.target.value })}
            style={styles.input}
          />
          <input
            type="url"
            placeholder="Image URL (optional)"
            value={newPromo.imageUrl}
            onChange={(e) =>
              setNewPromo({ ...newPromo, imageUrl: e.target.value })
            }
            style={styles.input}
          />
          <button onClick={handleAddPromo} style={styles.submitButton}>
            Add Promotion
          </button>
        </div>
      )}

      <div style={styles.promoGrid}>
        {promos.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <p style={styles.emptyText}>No promotions yet</p>
            {isAdmin && (
              <p style={styles.emptySubtext}>
                Click "Add New Promo" to get started
              </p>
            )}
          </div>
        ) : (
          promos.map((promo) => (
            <div key={promo.id} style={styles.promoCard}>
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
              <div style={styles.promoContent}>
                <div style={styles.promoHeader}>
                  <h3 style={styles.promoTitle}>{promo.title}</h3>
                  <span style={styles.promoDate}>{formatDate(promo.date)}</span>
                </div>
                {promo.description && (
                  <p style={styles.promoDescription}>{promo.description}</p>
                )}
                <div style={styles.promoActions}>
                  <a
                    href={promo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.promoLink}
                  >
                    🔗 Visit Link
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeletePromo(promo.id)}
                      style={styles.deleteButton}
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
        <div style={styles.loginPrompt}>
          <p style={styles.loginText}>
            Only the site administrator can add and manage promotional links
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
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
    transition: 'all 0.3s ease',
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
    transition: 'all 0.3s ease',
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
    transition: 'all 0.3s ease',
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
    transition: 'all 0.3s ease',
  },
  deleteButton: {
    padding: '10px 15px',
    fontSize: '16px',
    background: 'rgba(239, 68, 68, 0.8)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
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
