import type { GarbageType, Municipality } from '../types/models';

export interface SearchResult {
  keyword: string;
  garbageType: GarbageType;
  notes?: string;
}

const COMMON_ITEMS: Array<{ keyword: string; aliases: string[]; garbageTypeId: string; notes?: string }> = [
  { keyword: '生ごみ', aliases: ['なまごみ', '食べ残し', '残飯'], garbageTypeId: 'burnable' },
  { keyword: '紙くず', aliases: ['かみくず', 'ティッシュ', 'ちり紙'], garbageTypeId: 'burnable' },
  { keyword: '衣類', aliases: ['いるい', '服', '洋服', 'Tシャツ'], garbageTypeId: 'burnable' },
  { keyword: '革製品', aliases: ['かわせいひん', 'カバン', 'バッグ', '靴'], garbageTypeId: 'burnable' },
  { keyword: '木くず', aliases: ['きくず', '割り箸', '枝'], garbageTypeId: 'burnable' },
  { keyword: 'おむつ', aliases: ['オムツ', 'おしめ'], garbageTypeId: 'burnable', notes: '汚物を取り除いてから出す' },
  { keyword: 'ぬいぐるみ', aliases: ['人形'], garbageTypeId: 'burnable' },
  { keyword: 'ゴム製品', aliases: ['ごむ', '長靴'], garbageTypeId: 'burnable' },

  { keyword: 'プラスチック容器', aliases: ['プラ容器', 'パック', 'トレイ', '食品トレイ'], garbageTypeId: 'plastic' },
  { keyword: 'ビニール袋', aliases: ['ポリ袋', 'レジ袋'], garbageTypeId: 'plastic' },
  { keyword: 'ラップ', aliases: ['食品ラップ', 'サランラップ'], garbageTypeId: 'plastic' },
  { keyword: '発泡スチロール', aliases: ['はっぽう', 'スチロール'], garbageTypeId: 'plastic' },
  { keyword: 'シャンプーボトル', aliases: ['ボトル', 'リンス', '洗剤ボトル'], garbageTypeId: 'plastic' },
  { keyword: 'カップ麺容器', aliases: ['カップラーメン', 'カップめん'], garbageTypeId: 'plastic' },

  { keyword: '金属', aliases: ['きんぞく', 'フライパン', '鍋', 'やかん'], garbageTypeId: 'non-burnable' },
  { keyword: 'ガラス', aliases: ['がらす', 'コップ', 'グラス', '花瓶'], garbageTypeId: 'non-burnable' },
  { keyword: '陶器', aliases: ['とうき', '茶碗', '皿', '食器'], garbageTypeId: 'non-burnable' },
  { keyword: '傘', aliases: ['かさ', '日傘'], garbageTypeId: 'non-burnable' },
  { keyword: '小型家電', aliases: ['ドライヤー', 'アイロン', '電卓'], garbageTypeId: 'non-burnable' },
  { keyword: '鏡', aliases: ['かがみ', 'ミラー'], garbageTypeId: 'non-burnable' },

  { keyword: 'ペットボトル', aliases: ['PETボトル', 'ペット'], garbageTypeId: 'petbottle', notes: 'キャップとラベルはプラスチックへ' },

  { keyword: '蛍光灯', aliases: ['けいこうとう', '蛍光管'], garbageTypeId: 'hazardous' },
  { keyword: '乾電池', aliases: ['かんでんち', '電池', 'ボタン電池'], garbageTypeId: 'hazardous' },
  { keyword: 'スプレー缶', aliases: ['エアゾール', 'ガス缶'], garbageTypeId: 'hazardous', notes: '使い切ってから出す' },
  { keyword: '刃物', aliases: ['はもの', '包丁', 'カッター', 'ハサミ', 'ナイフ'], garbageTypeId: 'hazardous', notes: '紙に包んで「刃物」と表示' },
  { keyword: 'ライター', aliases: ['ガスライター', '100円ライター'], garbageTypeId: 'hazardous' },
  { keyword: '体温計', aliases: ['たいおんけい', '水銀体温計'], garbageTypeId: 'hazardous' },
];

export function searchItems(query: string, municipality: Municipality): SearchResult[] {
  if (!query || query.length === 0) return [];

  const q = query.toLowerCase().trim();
  const typeMap = new Map(municipality.garbageTypes.map((t) => [t.typeId, t]));

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const item of COMMON_ITEMS) {
    const gt = typeMap.get(item.garbageTypeId);
    if (!gt) continue;

    const matches =
      item.keyword.toLowerCase().includes(q) ||
      item.aliases.some((a) => a.toLowerCase().includes(q));

    if (matches && !seen.has(item.keyword)) {
      seen.add(item.keyword);
      results.push({
        keyword: item.keyword,
        garbageType: gt,
        notes: item.notes,
      });
    }
  }

  return results;
}

export function getAllCategories(municipality: Municipality): Array<{ garbageType: GarbageType; items: string[] }> {
  const typeMap = new Map(municipality.garbageTypes.map((t) => [t.typeId, t]));
  const grouped = new Map<string, string[]>();

  for (const item of COMMON_ITEMS) {
    const existing = grouped.get(item.garbageTypeId) ?? [];
    existing.push(item.keyword);
    grouped.set(item.garbageTypeId, existing);
  }

  return Array.from(grouped.entries())
    .map(([typeId, items]) => {
      const gt = typeMap.get(typeId);
      if (!gt) return null;
      return { garbageType: gt, items };
    })
    .filter(Boolean) as Array<{ garbageType: GarbageType; items: string[] }>;
}
