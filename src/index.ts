import Loki from 'lokijs';

import { generateUpdateNode, generateAddNode } from './generate-node';
import { diffTree } from './diff-tree';
import { parse } from './md-tools';
import { FullNode, ID, Node, NodeDB, RootDB } from './types';

/**
 * 
- Refactor to dynamically add node types
  - make everything async
  - seperate db implementation
- update listitem when checked
- get hash when type is listitem or paragraph
  - if todo, add todo tag
  - if done, add done tag
- update tag when deleted
- handle queries
  - save query if found
  - update query results appropriately
- add query results while generating text
  - update query with results
 */

const txt = ` hello 1  **sdsd** 

new para§ [path](path.md)
`;
async function start() {
  const dbFuns = await getDB();
  const filePath = '/Users/vamshi/Dropbox/life/test.md';
  let file = dbFuns.getFile(filePath);
  if (!file) {
    file = dbFuns.addFile(filePath);
    console.log({ file });
  }
  const text = await parse(txt);
  const oldTree = dbFuns.getTree(file.$loki);
  console.log({ text, oldTree: JSON.stringify(oldTree) });
  diffTree(oldTree, text, {
    addNode: dbFuns.addNode,
    updateNode: dbFuns.updateNode,
    deleteNode: dbFuns.deleteNode,
  });
}
start().then(() => {
  console.log('done');
});

//---------------------- DB --------------------------

async function getDB() {
  const db = await initDB();
  return {
    addNode: (node: Node) => addNode(node, db.nodes),
    updateNode: (node: NodeDB) => updateNode(node, db.nodes),
    deleteNode: (node: NodeDB) => deleteNode(node, db.nodes),
    getNode: (nodeId: ID) => db.nodes.findOne({ $loki: nodeId }),
    getFile: (filePath: string): RootDB | null => db.nodes.findOne({ type: 'root', filePath }),
    addFile: (filePath: string): RootDB => db.nodes.insertOne({ type: 'root', filePath, childIds: [] }),
    getTree: (id: ID) => getTree(id, db.nodes),
  };
}
function getTree(nodeId: ID, nodes: Collection<NodeDB>): FullNode | undefined {
  const node = { ...nodes.findOne({ $loki: nodeId }) } as FullNode;
  if (node === null) {
    return undefined;
  }
  if (node.type === 'text') {
    return node;
  } else {
    node.children = node.childIds.map(($loki: ID) => getTree($loki, nodes)).filter((n): n is FullNode => n !== null);
    return node;
  }
}
function updateNode(node: NodeDB, nodes: Collection<NodeDB>): NodeDB {
  return nodes.update(generateUpdateNode(node) as NodeDB);
}

function addNode(node: Node, nodes: Collection<NodeDB>): NodeDB {
  const addedNode = nodes.insertOne({
    ...generateAddNode(node),
    ...(node.type !== 'text' ? { childIds: node.children.map((c: Node) => addNode(c, nodes).$loki) } : {}),
  } as NodeDB);
  if (addedNode === undefined) {
    throw new Error('Error while adding node' + JSON.stringify(node));
  }
  return addedNode as NodeDB;
}

function deleteNode(node: NodeDB, nodes: Collection<NodeDB>) {
  if (node.type !== 'text') {
    nodes.removeWhere({ $loki: { $in: node.childIds } });
  }
  nodes.remove(node);
}

async function initDB(): Promise<{
  nodes: Collection<any>;
  // tags: Collection<Tag>;
  // queries: Collection<Query>;
}> {
  let nodes: Collection<NodeDB> | null;
  // let tags: Collection<Tag> | null;
  // let queries: Collection<Query> | null;
  return new Promise((resolve, reject): void => {
    try {
      const db = new Loki('q3.json', {
        autoload: true,
        autoloadCallback: () => {
          nodes = db.getCollection('nodes');
          if (nodes === null) {
            nodes = db.addCollection('nodes');
          }
          // tags = db.getCollection('tags');
          // if (tags === null) {
          //   tags = db.addCollection('tags', { indices: ['name', 'filePath'] });
          // }
          // queries = db.getCollection('queries');
          // if (queries === null) {
          //   queries = db.addCollection('queries', { indices: ['filePath'] });
          // }
          // if (tags && nodes && queries) {
          if (nodes) {
            resolve({ nodes });
          } else {
            reject('something went wrong while loading DB');
          }
        },
        autosave: true,
        autosaveInterval: 4000,
      });
    } catch (err) {
      reject(err);
    }
  });
}
