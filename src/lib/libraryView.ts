import type { MuscleId } from '../types';

export interface LibraryView {
  q: string;
  zone: string | null;
  muscle: MuscleId | null;
  equipment: string | null;
  fav: boolean;
  archived: boolean;
  sort: 'az' | 'muscle';
  limit: number;
  scrollY: number;
  filterScrollLeft: number;
}

const views = new Map<string, LibraryView>();

export function getLibraryView(key: string, accountId?: string): LibraryView | undefined {
  return views.get(JSON.stringify([accountId, key]));
}

export function saveLibraryView(key: string, accountId: string | undefined, view: LibraryView): void {
  views.set(JSON.stringify([accountId, key]), view);
}
