import { DB } from './db';
import { expandChildren, getTextForListItem, getTextForParagraph } from './utils';
export function compareListItems(firstNode: any, secondNode: any, db: DB): boolean {
  if (!(firstNode.childIds || firstNode.children) && !(secondNode.childIds || secondNode.children)) {
    return true;
  }
  if ((firstNode.childIds || firstNode.children).length !== (secondNode.childIds || secondNode.children).length) {
    return false;
  }
  if (getTextForListItem(firstNode, db) !== getTextForListItem(secondNode, db)) {
    return false;
  }
  const expandedFirstNode = expandChildren(firstNode, db);
  const expandedSecondNode = expandChildren(secondNode, db);
  return expandedFirstNode.every((child: any, index: number) => compareListItems(child, expandedSecondNode[index], db));
}

export function compareParagraphs(node1: any, node2: any, db: DB): boolean {
  if (!(node1.childIds || node1.children) && !(node2.childIds || node2.children)) {
    return true;
  }
  if ((node1.childIds || node1.children).length !== (node2.childIds || node2.children).length) {
    return false;
  }
  return getTextForParagraph(node1, db) === getTextForParagraph(node2, db);
}
/*
 for all queries in the file
  check if a query exists
  fetch results for query in updated file
  compare both query results
  if different, 
*/

function compareQueryResults() {}
function getIfQueryExists() {}

export function updateDB(node: any, filePath: string, db: DB) {
  const file = db.getFile(filePath);
  if (!file) {
    //add full tree
  } else {
    // diff and update
  }
}
