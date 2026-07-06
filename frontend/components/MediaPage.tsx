/**
 * MediaPage
 * =========
 * A media hub reached from "More". Two sections:
 *   1. Betgistics Library — curated audio/video hosted with the app
 *      (config/mediaLibrary.ts), available to everyone.
 *   2. Your Uploads — audio/video the user adds from this device, stored
 *      locally in the browser (utils/mediaStore.ts, IndexedDB). Files play
 *      inline and persist across reloads; they live on this device only.
 *
 * Styling reuses the design-system `.panel`, `.btn-*`, and `.empty-state`
 * classes; a few media-specific classes live in index.css.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_LIBRARY, type LibraryItem } from '../config/mediaLibrary';
import {
  addMedia,
  deleteMedia,
  getMediaBlob,
  isMediaSupported,
  listMedia,
  formatBytes,
  type MediaMeta,
} from '../utils/mediaStore';

/* A small inline player that lazily resolves a stored Blob to an object URL. */
function UploadedPlayer({ item, onDelete }: { item: MediaMeta; onDelete: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let created: string | null = null;
    getMediaBlob(item.id).then((blob) => {
      if (!active || !blob) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [item.id]);

  return (
    <div className="media-card">
      <div className="media-card-head">
        <div className="media-card-title" title={item.name}>
          <span aria-hidden="true">{item.kind === 'video' ? '🎞️' : '🎵'}</span>
          <span className="media-card-name">{item.name}</span>
        </div>
        <button
          type="button"
          className="media-delete"
          aria-label={`Delete ${item.name}`}
          onClick={() => onDelete(item.id)}
        >
          Remove
        </button>
      </div>

      {!url ? (
        <div className="media-loading">Loading…</div>
      ) : item.kind === 'video' ? (
        <video className="media-video" src={url} controls preload="metadata" />
      ) : (
        <audio className="media-audio" src={url} controls preload="metadata" />
      )}

      <div className="media-meta">
        {item.kind} · {formatBytes(item.size)} · added {new Date(item.addedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function LibraryPlayer({ item }: { item: LibraryItem }) {
  return (
    <div className="media-card">
      <div className="media-card-head">
        <div className="media-card-title">
          <span aria-hidden="true">{item.icon ?? '🎵'}</span>
          <span className="media-card-name">{item.title}</span>
        </div>
      </div>
      {item.description && <p className="media-desc">{item.description}</p>}

      {item.kind === 'youtube' ? (
        <div className="media-video-wrap">
          <iframe
            className="media-embed"
            src={`https://www.youtube.com/embed/${item.src}`}
            title={item.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : item.kind === 'video' ? (
        <video className="media-video" src={item.src} controls preload="metadata" />
      ) : (
        <audio className="media-audio" src={item.src} controls preload="metadata" />
      )}
    </div>
  );
}

export function MediaPage() {
  const supported = isMediaSupported();
  const [uploads, setUploads] = useState<MediaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    if (!supported) {
      setLoading(false);
      return;
    }
    try {
      setUploads(await listMedia());
    } catch {
      setError('Could not read your saved media on this device.');
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setBusy(true);
      let added = 0;
      let rejected = 0;
      for (const file of Array.from(files)) {
        try {
          await addMedia(file);
          added += 1;
        } catch {
          rejected += 1;
        }
      }
      await refresh();
      setBusy(false);
      if (rejected > 0) {
        setError(
          added > 0
            ? `Added ${added} file${added === 1 ? '' : 's'}; skipped ${rejected} unsupported file${rejected === 1 ? '' : 's'} (audio/video only).`
            : 'Those files are not supported. Please choose audio or video files.',
        );
      }
    },
    [refresh],
  );

  const onDelete = useCallback(async (id: string) => {
    await deleteMedia(id);
    setUploads((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <div className="panel">
      <div className="media-header">
        <div>
          <h2 className="panel-title" style={{ marginBottom: '0.25rem' }}>Media</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            Your audio and video library. Upload your own clips or play the hosted Betgistics library.
          </p>
        </div>
      </div>

      {/* ---------- Upload zone ---------- */}
      {supported ? (
        <>
          <div
            className={`media-dropzone ${dragOver ? 'is-drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <div className="media-drop-icon" aria-hidden="true">⬆️</div>
            <div className="media-drop-title">
              {busy ? 'Uploading…' : 'Drag & drop, or tap to upload'}
            </div>
            <div className="media-drop-sub">Audio or video files · saved on this device</div>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {error && <div className="error-message" style={{ marginTop: '0.75rem' }}>⚠ {error}</div>}
        </>
      ) : (
        <div className="error-message">
          This browser can’t store uploads locally. You can still play the Betgistics library below.
        </div>
      )}

      {/* ---------- Your uploads ---------- */}
      <div className="media-section-title">
        Your Uploads
        {uploads.length > 0 && <span className="media-count">{uploads.length}</span>}
      </div>

      {loading ? (
        <div className="media-loading">Loading your media…</div>
      ) : uploads.length === 0 ? (
        <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
          <h3>No uploads yet</h3>
          <p>Add an audio or video file above and it will appear here, ready to play.</p>
        </div>
      ) : (
        <div className="media-grid">
          {uploads.map((item) => (
            <UploadedPlayer key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* ---------- Curated library ---------- */}
      {MEDIA_LIBRARY.length > 0 && (
        <>
          <div className="media-section-title">Betgistics Library</div>
          <div className="media-grid">
            {MEDIA_LIBRARY.map((item) => (
              <LibraryPlayer key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      <p className="media-privacy-note">
        Uploaded files are stored privately in this browser on this device — they are not sent to a
        server and are visible only to you.
      </p>
    </div>
  );
}

export default MediaPage;
