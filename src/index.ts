import { diffTree } from './diff-tree';
import { parse } from './md-tools';
import { FullNode, ID, Node, NodeDB, RootDB } from './types';
import Loki from 'lokijs';

const txt = ` hello 1

new para§
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
  let nodeToUpdate;
  switch (node.type) {
    case 'text':
      nodeToUpdate = { type: 'text', value: node.value, $loki: node.$loki, meta: node.meta };
      break;

    case 'listItem':
      nodeToUpdate = {
        type: 'listItem',
        childIds: node.childIds,
        ordered: node.ordered,
        checked: node.checked,
        $loki: node.$loki,
        meta: node.meta,
      };
      break;
    case 'root':
      nodeToUpdate = {
        type: 'root',
        childIds: node.childIds,
        filePath: node.filePath,
        $loki: node.$loki,
        meta: node.meta,
      };
      break;

    default:
      const c = node.childIds;
      nodeToUpdate = { type: node.type, childIds: c, $loki: node.$loki, meta: node.meta };
      break;
  }
  const updatedNode = nodes.update(nodeToUpdate as NodeDB);
  return updatedNode as NodeDB;
}

function addNode(node: Node, nodes: Collection<NodeDB>): NodeDB {
  let nodeToAdd;
  switch (node.type) {
    case 'text':
      nodeToAdd = { type: 'text', value: node.value };
      break;

    case 'listItem':
      nodeToAdd = {
        type: 'listItem',
        childIds: node.children.map((c) => addNode(c, nodes).$loki),
        ordered: node.ordered,
        checked: node.checked,
      };
      break;

    default:
      nodeToAdd = { type: node.type, childIds: node.children.map((c: Node) => addNode(c, nodes).$loki) };
      break;
  }
  const addedNode = nodes.insertOne(nodeToAdd as NodeDB);
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
