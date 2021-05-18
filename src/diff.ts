import { DB } from './db';
import { ID } from './types';

export function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function diff(news: string[], old: string[]) {
  const a1 = new Set(old);
  const a2 = new Set(news);
  const unique = (arr: string[], a: Set<string>): string[] => arr.filter((x) => !a.has(x)); //.map((s) => indexFromString(s));
  const unique1 = unique(old, a2);
  const unique2 = unique(news, a1);
  const deletions = unique1.filter((n) => !unique2.includes(n)).map((s) => old.indexOf(s));
  const additions = unique2.filter((n) => !unique1.includes(n)).map((s) => news.indexOf(s));
  // return { additions, deletions };
  const updates = additions.filter((d) => deletions.includes(d));
  return {
    updates,
    additions: additions.filter((a) => !updates.includes(a)),
    deletions: deletions.filter((a) => !updates.includes(a)),
  };
}

export type Leaf = { $loki?: ID; value: string; type: string; filePath?: string };
export type Branch = { $loki?: ID; children: Branch[]; type: string; filePath?: string };
export type Tree = Leaf | Branch;

export function isLeaf(node: Tree): node is Leaf {
  if (!node) {
    return true;
  }
  return (node as Leaf).value !== undefined && (node as Branch).children === undefined;
}

export function toString(item: Tree): string {
  if (!item) return '';
  if (isLeaf(item)) return item.value;
  return cyrb53(item.children.map(toString).sort().join('')) + '';
}

export function getTree(nodeId: ID, db: DB) {
  const node = db.getNode(nodeId, true);
  if (node?.childIds) node.children = node.childIds.map((id: ID) => getTree(id, db));
  return node;
}
