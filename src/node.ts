import { DB } from './db';
import { ID, Text } from './types';

// TODO: Have better type for node
//
export function addNode(node: any, filePath: string, parentId: ID | null, db: DB): ID | undefined {
  node.filePath = filePath;
  node.parentId = parentId;
  if (node.children && node.children.some((child: any) => child.ignore)) {
    return undefined;
  }
  const addedNode = db.addNode(node);
  if (node.children && node.children.length > 0) {
    const newChildrenIds: ID[] = [];
    node.children.forEach((child: any) => {
      if (!child.ignore) {
        const addedNodeId = addNode(child, filePath, addedNode.$loki, db);
        if (addedNodeId) {
          newChildrenIds.push(addedNodeId);
        }
      }
    });
    node.children = newChildrenIds;
    addedNode.childrenIds = newChildrenIds;
  }
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
    addedNode.tags = tagIds;
  }
  if (node.queries && (node.queries.include.length > 0 || node.queries.exclude.length > 0)) {
    const queryAdded = db.addQuery({ ...node.queries, filePath, results: [], node: addedNode.$loki });
    if (queryAdded) {
      node.queries = queryAdded.$loki;
      addedNode.queries = queryAdded.$loki;
    }
  }
  db.updateNode(addedNode);

  return addedNode.$loki;
}
