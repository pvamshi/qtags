// import { execPath } from 'node:process';
// import { DB } from './db';

// export function getTextForListItem(node: any, db: DB): string {
//   // if children does not exist, get from db
//   if (!node.childIds && !node.children) {
//     return '';
//   }

//   const children = expandChildren(node, db);
//   if (children.length === 0) {
//     return '';
//   }
//   return getTextForParagraph(children[0], db);
// }
// export function getTextForParagraph(node: any, db: DB): string {
//   if (!node.childIds && !node.children) {
//     return '';
//   }
//   const children = expandChildren(node, db);
//   if (children.length === 0) {
//     return '';
//   }
//   return children.map((child: any) => child.value).join('');
// }

// export function expandChildren(node: any, db) {
//   return node.children || node.childIds.length === 0 ? [] : node.childIds.map(db.getNode);
// }

export const runSerialReduce = <U>(a: ((arg: U) => Promise<U>)[], init: U) =>
  a.reduce<Promise<U>>((f1: Promise<U>, f2: (res: U) => Promise<U>) => f1.then(f2), Promise.resolve(init));

export const runSerial = (a: Promise<any>[]) =>
  a.reduce<Promise<any>>((f1: Promise<any>, f2: Promise<any>) => f1.then(() => f2), Promise.resolve(undefined));
// cyrb53
export function toHash(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0) + '';
}
