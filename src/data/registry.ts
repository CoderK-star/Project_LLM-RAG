import type { Municipality } from '../types/models';

export interface MunicipalityEntry {
  id: string;
  name: string;
  prefecture: string;
}

export interface PrefectureGroup {
  prefecture: string;
  municipalities: MunicipalityEntry[];
}

const dataModules: Record<string, () => Municipality> = {
  nagareyama: () => require('./nagareyama.json') as Municipality,
};

export function getMunicipalityList(): MunicipalityEntry[] {
  return Object.values(dataModules).map((loader) => {
    const m = loader();
    return { id: m.municipalityId, name: m.municipalityName, prefecture: m.prefecture };
  });
}

export function getMunicipalityGroupedByPrefecture(): PrefectureGroup[] {
  const list = getMunicipalityList();
  const grouped = new Map<string, MunicipalityEntry[]>();

  for (const entry of list) {
    const existing = grouped.get(entry.prefecture) ?? [];
    existing.push(entry);
    grouped.set(entry.prefecture, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([prefecture, municipalities]) => ({
      prefecture,
      municipalities: municipalities.sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    }));
}

export function loadMunicipalityById(id: string): Municipality | null {
  const loader = dataModules[id];
  if (!loader) return null;
  return loader();
}

export function getMunicipalityIds(): string[] {
  return Object.keys(dataModules);
}
