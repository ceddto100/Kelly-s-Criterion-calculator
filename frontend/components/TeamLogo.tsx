/**
 * <TeamLogo> / <AutoTeamLogo> / <LeagueLogo>
 *
 * TeamLogo renders a known logo URL and falls back to a colored initials badge
 * when there is no URL or the image fails to load. AutoTeamLogo looks the team
 * up by name/abbreviation/id in the league's directory first. LeagueLogo shows
 * a league mark with an emoji fallback.
 */
import React, { useEffect, useState } from 'react';
import {
  LEAGUE_LOGOS,
  cdnLogoUrl,
  findTeam,
  logoFor,
  toLeague,
  useTeamDirectory,
} from '../utils/teamLogos';

function initials(name: string, abbr?: string | null): string {
  if (abbr) return abbr.slice(0, 4).toUpperCase();
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

export interface TeamLogoProps {
  src?: string | null;
  name: string;
  abbr?: string | null;
  color?: string | null;
  size?: number;
  style?: React.CSSProperties;
}

export function TeamLogo({ src, name, abbr, color, size = 28, style }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        title={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{
          width: size, height: size, objectFit: 'contain', flexShrink: 0,
          // Keeps very dark logos readable on the app's dark themes.
          filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.45))',
          ...style,
        }}
      />
    );
  }

  const label = initials(name, abbr);
  return (
    <span
      aria-label={`${name}`}
      title={name}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: color || 'var(--surface-2, rgba(255,255,255,0.12))',
        border: '1px solid rgba(255,255,255,0.25)',
        color: '#fff', fontWeight: 800, letterSpacing: '-0.02em',
        fontSize: Math.max(8, Math.round(size * (label.length > 2 ? 0.3 : 0.38))),
        lineHeight: 1,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export interface AutoTeamLogoProps {
  sport: string | null | undefined;
  name: string;
  abbr?: string | null;
  /** ESPN team id — required for college logos when there's no directory match. */
  id?: string | number | null;
  /** Use this URL when the caller already has one (e.g. from the scoreboard). */
  src?: string | null;
  color?: string | null;
  size?: number;
  style?: React.CSSProperties;
}

export function AutoTeamLogo({ sport, name, abbr, id, src, color, size, style }: AutoTeamLogoProps) {
  const league = toLeague(sport);
  // College logos are keyed by ESPN id, so with an id we can skip the (large) directory.
  const idIsEnough = !!id && (league === 'CFB' || league === 'CBB');
  const dir = useTeamDirectory(src || idIsEnough ? null : sport);
  let url = src || '';
  let teamColor = color || '';
  if (!url && league) {
    const team = (id && dir.find((t) => t.id === String(id))) || findTeam(dir, name, abbr);
    url = logoFor(team) || cdnLogoUrl(league, { abbr: team?.abbreviation || abbr, id: team?.id || id });
    teamColor = teamColor || team?.color || '';
  }
  return <TeamLogo src={url} name={name} abbr={abbr} color={teamColor} size={size} style={style} />;
}

export function LeagueLogo({
  sport,
  fallback,
  size = 20,
}: {
  sport: string;
  fallback: React.ReactNode;
  size?: number;
}) {
  const league = toLeague(sport);
  const src = league ? LEAGUE_LOGOS[league] : undefined;
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{fallback}</span>;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, objectFit: 'contain', flexShrink: 0,
        filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.5))',
      }}
    />
  );
}

export default TeamLogo;
