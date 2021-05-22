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
