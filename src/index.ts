import { addNodeToDB, deleteNodeFromDB, getNodeFromDB, queryForNode, updateNodeToDB } from './db';
import { diffTree } from './diff-tree';
import { generateAddNode } from './generate-node';
import { parse } from './md-tools';
import { isDefined, plugins } from './plugins';
import { FullNode, ID, Node, NodeDB, Root, TextDB } from './types';

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

const txt = ` hello 1


- new list #om #nama #shivaya
`;
async function start() {
  const filePath = '/Users/vamshi/Dropbox/life/test.md';
  const textTree = (await parse(txt)) as Root;
  textTree.filePath = filePath;

  const file = (await queryForNode({ type: 'root', filePath }))[0];

  const oldTree = file ? await getTree(file.$loki) : undefined;
  await diffTree(oldTree, file?.$loki, textTree, {
    addNode,
    updateNode,
    deleteNode,
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
  await Promise.all(
    plugins
      .map((p) => p['preUpdate'])
      .filter(isDefined)
      .map((p) => p(node)),
  );
  console.log('update', node);
  const updatedNode = await updateNodeToDB(node);
  await Promise.all(
    plugins
      .map((p) => p['postUpdate'])
      .filter(isDefined)
      .map((p) => p(updatedNode)),
  );
  return updatedNode;
}

async function addNode(node: Node, parentId?: ID): Promise<NodeDB> {
  await Promise.all(
    plugins
      .map((p) => p['preAdd'])
      .filter(isDefined)
      .map((p) => p(node)),
  );

  const generateNode =
    node.type === 'text'
      ? ({ ...generateAddNode(node), parentId } as TextDB)
      : ({ ...generateAddNode(node), parentId, childIds: [] } as Exclude<TextDB, NodeDB>);
  const addedNode = (await addNodeToDB(generateNode)) as NodeDB;
  if (addedNode.type !== 'text' && node.type !== 'text') {
    addedNode.childIds = await Promise.all(node.children.map((c: Node) => addNode(c, addedNode.$loki))).then((n) =>
      n.map((m) => m.$loki),
    );
    updateNodeToDB(addedNode);
  }
  await Promise.all(
    plugins
      .map((p) => p['postAdd'])
      .filter(isDefined)
      .map((p) => p(addedNode)),
  );
  return addedNode as NodeDB;
}

async function deleteNode(nodeID: ID) {
  const node = await getNodeFromDB(nodeID);
  await Promise.all(
    plugins
      .map((p) => p['preDelete'])
      .filter(isDefined)
      .map((p) => p(node)),
  );
  if (node.type !== 'text') {
    await Promise.all(node.childIds.map((id) => deleteNode(id)));
  }
  await deleteNodeFromDB(node);
}
