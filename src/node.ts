import { DB } from './db';
import { ElementNodeDoc, ID, Text } from './types';

// TODO: Have better type for node
export function addNode(node: any, filePath: string, db: DB): ID | undefined {
  node.filePath = filePath;
  if (node.children && node.children.some((child: any) => child.ignore)) {
    return undefined;
  }
  if (node.children && node.children.length > 0) {
    const newChildrenIds: ID[] = [];
    node.children.forEach((child: any) => {
      if (!child.ignore) {
        const addedNodeId = addNode(child, filePath, db);
        if (addedNodeId) {
          newChildrenIds.push(addedNodeId);
        }
      }
    });
    node.children = newChildrenIds;
  }
  const addedNode = db.addNode(node);
  if (node.tags && node.tags.length > 0) {
    const tagIds: ID[] = [];
    node.tags.forEach((tag: string) => {
      const existingTag = db.getTagByName(tag);
      if (existingTag) {
        existingTag.references.push(addedNode.$loki);
        db.updateTag(existingTag);
        tagIds.push(existingTag.$loki);
      } else {
        const tagAdded = db.addTag(tag, filePath, [addedNode.$loki]);
        tagIds.push(tagAdded.$loki);
      }
    });
    node.tags = tagIds;
  }
  if (node.queries && (node.queries.include.length > 0 || node.queries.exclude.length > 0)) {
    const queryAdded = db.addQuery({ ...node.queries, filePath, results: [], node: addedNode.$loki });
    if (queryAdded) {
      node.queries = queryAdded.$loki;
    }
  }
  db.updateNode(addedNode);

  return addedNode.$loki;
}

function addText(node: any, filePath: string, db: DB) {
  // save text node
  const textNode = db.addNode({ ...node, tags: [] }) as Text & LokiObj;
  // save tags
  const tags = addTags(textNode, filePath, db);
  if (tags) {
    textNode.tags = tags;
    db.updateNode(textNode);
  }
  return textNode;

  // save queries
  // update text node

  // const textNode = db.addNode(node) as Text & LokiObj;
  // const tags = addTags();
  // textNode.tags = tags;
  // db.updateNode(textNode);
  // return textNode;

  // function addQueries() {
  //   const matches = node.value.matchAll(/(\s|^)(+|-)([a-zA-Z0-9-_.]+)/g);
  //   const tags = [];
  //   for (const match of matches) {
  //     const include = match[2] === '+';

  //     const tagAdded = db.addRefToTag(tag, filePath, textNode.$loki);
  //     tags.push(tagAdded.$loki);
  //   }
  //   return tags;
  // }
}

function addTags(textNode: Text & LokiObj, filePath: string, db: DB) {
  const matches = textNode.value.matchAll(/(\s|^)#([a-zA-Z0-9-_.]+)/g);
  const tags = [];
  for (const match of matches) {
    const tag = match[2];
    const tagAdded = db.addRefToTag(tag, filePath, textNode.$loki);
    tags.push(tagAdded.$loki);
  }
  return tags;
}
//============== File Node =========================

// function addFile(node: any, filePath: string, db: DB) {
//   cleanupExistingFile(db, filePath);
//   return db.addNode({ ...node, filePath, children: createChildrenNodes(node.children, db, filePath) });
// }
// function createChildrenNodes(nodes: any[], db: DB, filePath: string) {
//   return (nodes || []).map((child: any) => {
//     const newNode = addNode(child, db, filePath);
//     return newNode.$loki;
//   }) as ID[];
// }
// function cleanupExistingFile(db: DB, filePath: string) {
//   const fileNode = db.getFile(filePath);
//   if (fileNode) {
//     deleteNode(fileNode, db);
//     db.unlinkFileToTag(filePath);
//   }
// }

// function deleteNode(node: any, db: DB) {
//   (node?.children || []).forEach((id: ID) => deleteNode(id, db));
//   db.deleteNode(node.$loki);
// }
