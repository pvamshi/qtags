import { DB } from './db';
import { ElementNode, ElementNodeDoc, ID, Text } from './types';
import { addNode } from './node';

type RawNode = ElementNode & { children: any[] };
function plugin({ filePath, db }: { filePath: string; db: DB }) {
  return (tree: any) => {
    db.deleteAll(filePath); // can we somehow just update
    addNode(tree, filePath, db);
    // console.log(db.nodes.data);
  };
}
export default plugin;

// function addNode(node: RawNode, db: DB, filePath: string): ElementNodeDoc { if (node.type === 'root' && filePath) { const file = db.getFile(filePath); if (file) { console.log({ file }); deleteNode(file.$loki, db); db.unlinkFileToTag(filePath); } node.filePath = filePath; } else if (node.type === 'text') { return addTextNode(node, db, filePath); } if (node.children) { const children = node.children.map((child: RawNode) => { const newNode = addNode(child, db, filePath);
//       return newNode.$loki;
//     }) as any[];
//     return db.addNode({ ...node, children });
//   }
//   return db.addNode(node);
// }

// function deleteNode(nodeId: ID, db: DB) {
//   if (!nodeId || typeof nodeId !== 'number') {
//     return;
//   }
//   const node = db.getNode(nodeId) as ElementNodeDoc;
//   if (!node) {
//     return;
//   }
//   if (node.children) {
//     node.children.forEach((id) => deleteNode(id, db));
//   }
//   db.deleteNode(node.$loki);
// }

// function addTextNode(node: Text, db: DB, filePath: string) {
//   const textNode = db.addNode(node) as Text & LokiObj;
//   const tags = addTags();
//   textNode.tags = tags;
//   db.updateNode(textNode);
//   return textNode;

//   function addTags() {
//     const matches = node.value.matchAll(/(\s|^)#([a-zA-Z0-9-_.]+)/g);
//     const tags = [];
//     for (const match of matches) {
//       const tag = match[2];
//       const tagAdded = db.addRefToTag(tag, filePath, textNode.$loki);
//       tags.push(tagAdded.$loki);
//     }
//     return tags;
//   }
//   function addQueries() {
//     const matches = node.value.matchAll(/(\s|^)(+|-)([a-zA-Z0-9-_.]+)/g);
//     const tags = [];
//     for (const match of matches) {
//       const include = match[2] === '+';

//       const tagAdded = db.addRefToTag(tag, filePath, textNode.$loki);
//       tags.push(tagAdded.$loki);
//     }
//     return tags;
//   }
// }
