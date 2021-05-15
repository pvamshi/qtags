import { addNodeToDB, deleteNodeFromDB, getNodeFromDB, queryForNode, updateNodeToDB } from './db';
import { diffTree } from './diff-tree';
import { parse } from './md-tools';
import { isDefined, plugins } from './plugins';
import { FullNode, ID, Node, NodeDB, Root } from './types';

/**
 * 
- Refactor to dynamically add node types
  - make everything async
  - seperate db implementation
  - Refactor to make node types as class, instead of switch case
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
`;
async function start() {
  const filePath = '/Users/vamshi/Dropbox/life/test.md';
  const textTree = (await parse(txt)) as Root;
  textTree.filePath = filePath;

  const file = (await queryForNode({ type: 'root', filePath }))[0];

  const oldTree = file ? await getTree(file.$loki) : undefined;
  diffTree(oldTree, file?.$loki, textTree, {
    addNode: addNode,
    updateNode: updateNode,
    deleteNode: deleteNode,
  });
}
start().then(() => {
  console.log('done');
});

//---------------------- DB --------------------------

async function getTree(nodeId: ID): Promise<FullNode | undefined> {
  const node = { ...(await getNodeFromDB(nodeId)) } as FullNode;
  if (node === null) {
    return undefined;
  }
  if (node.type === 'text') {
    return node;
  } else {
    node.children = (await Promise.all(node.childIds.map(($loki: ID) => getTree($loki)))).filter(
      (n: FullNode | undefined): n is FullNode => n !== null,
    );
    return node;
  }
}
async function updateNode(node: NodeDB): Promise<NodeDB> {
  return updateNodeToDB(node);
}

async function addNode(node: Node, parentId?: ID): Promise<NodeDB> {
  plugins
    .map((p) => p['preAdd'])
    .filter(isDefined)
    .forEach((p) => p(node));

  const addedNode = await addNodeToDB(node, parentId);
  plugins
    .map((p) => p['postAdd'])
    .filter(isDefined)
    .forEach((p) => p(addedNode));
  return addedNode as NodeDB;
}

async function deleteNode(node: NodeDB) {
  await deleteNodeFromDB(node);
}
