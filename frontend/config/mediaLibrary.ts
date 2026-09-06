/**
 * Curated Betgistics media library
 * ================================
 * The audio/video that ships with the app and is hosted for every visitor.
 * To publish new hosted media: drop the file in `frontend/public/` (or
 * `frontend/public/media/`) and add an entry here. User-uploaded media is
 * handled separately by utils/mediaStore.ts (device-local).
 */

export type LibraryKind = 'audio' | 'video' | 'youtube';

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  description?: string;
  /** For audio/video: a path under /public. For youtube: the video id. */
  src: string;
  icon?: string;
}

export const MEDIA_LIBRARY: LibraryItem[] = [
  {
    id: 'intro',
    kind: 'audio',
    title: 'Introduction',
    description: 'What Betgistics is and how to get the most from it.',
    src: '/intro.mp3',
    icon: '🎙️',
  },
  {
    id: 'mission',
    kind: 'audio',
    title: 'Mission Statement',
    description: 'The philosophy behind disciplined, data-driven betting.',
    src: '/mission_statement.mp3',
    icon: '🎯',
  },
  {
    id: 'quick-guide',
    kind: 'audio',
    title: 'Quick Start Guide',
    description: 'A fast walkthrough of the matchup → probability → stake flow.',
    src: '/quick_guide.mp3',
    icon: '🎧',
  },
  {
    id: 'math-stats',
    kind: 'audio',
    title: 'Magnify the Stats',
    description: 'How the projection math turns team stats into an edge.',
    src: '/math_stats.mp3',
    icon: '🔍',
  },
  {
    id: 'demo',
    kind: 'youtube',
    title: 'Product Demo',
    description: 'A short video tour of the Betgistics workflow.',
    src: 'A6RZpBjjIns',
    icon: '🎬',
  },
];
