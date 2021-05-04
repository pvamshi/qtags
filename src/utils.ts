import { execPath } from 'node:process';
import { DB } from './db';

export function getTextForListItem(node: any, db: DB): string {
  // if children does not exist, get from db
  if (!node.childIds && !node.children) {
    return '';
  }

  const children = expandChildren(node, db);
  if (children.length === 0) {
    return '';
  }
  return getTextForParagraph(children[0], db);
}
export function getTextForParagraph(node: any, db: DB): string {
  if (!node.childIds && !node.children) {
    return '';
  }
  const children = expandChildren(node, db);
  if (children.length === 0) {
    return '';
  }
  return children.map((child: any) => child.value).join('');
}

export function expandChildren(node: any, db) {
  return node.children || node.childIds.length === 0 ? [] : node.childIds.map(db.getNode);
}
