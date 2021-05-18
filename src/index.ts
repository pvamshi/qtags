import { addNodeToDB, deleteNodeFromDB, getNodeFromDB, queryForNode, updateNodeToDB } from './db';
import { diffTree } from './diff-tree';
import { generateAddNode } from './generate-node';
import { compile, parse } from './md-tools';
import { isDefined, plugins } from './plugins';
import { FullNode, ID, List, ListItem, ListItemDB, Node, NodeDB, Paragraph, ParagraphDB, Root, TextDB } from './types';

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
- update hash only . when parent has only hash, exclude it and include children in the results

- main tasks
  + generate result from Db
  - if node has query, attach query results
- While updating, check for query results
 */
/**
 * 
 Bugs: 
  - sometimes text in query paragraph is vanished
  - we get null for some query
  - delete. update not seems to work 

 */

const txt = ` hello 12346 #up

sdsfd
sfsdf +up 

`;
async function start() {
  const d = new Date().getTime();
  console.time(d + '');
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

  const fileNew = (await queryForNode({ type: 'root', filePath }))[0];
  const finalTree = await getNode(fileNew.$loki);
  console.log(JSON.stringify(finalTree));
  const out = await compile(finalTree);
  console.log('----------');
  console.log(out);
  console.log('----------');

  console.timeEnd(d + '');
}
start().then(() => {
  console.log('done');
});

//---------------------- DB --------------------------

async function getNode(nodeId: ID): Promise<Node | undefined> {
  const nodeFromDB = await getNodeFromDB(nodeId);
  if (!nodeFromDB) {
    return undefined;
  }
  await Promise.all(
    plugins
      .map((p) => p['preBuild'])
      .filter(isDefined)
      .map((f) => f(nodeFromDB)),
  );
  const node = { ...nodeFromDB, children: [] } as Node;
  if (nodeFromDB.type !== 'text' && node.type !== 'text') {
    const children = (await Promise.all(nodeFromDB.childIds.map((id: ID) => getNode(id)))).filter(isDefined);
    node.children = (
      await Promise.all(
        children.map(async (child): Promise<Node[]> => {
          if (child.type === 'paragraph') {
            const results = (
              await Promise.all(
                plugins
                  .map((p) => p['postBuildChildParagraph'])
                  .filter(isDefined)
                  .map((f) => f(child as ParagraphDB & Paragraph)),
              )
            ).flat();
            // console.log(JSON.stringify([child, ...results]));
            return [child, ...results];
          } else if (child.type === 'listItem') {
            const results = (
              await Promise.all(
                plugins
                  .map((p) => p['postBuildChildListItem'])
                  .filter(isDefined)
                  .map((f) => f(child as ListItem & ListItemDB)),
              )
            ).flat() as ListItem[] | Paragraph[];
            child.children = child.children.concat(
              results.map((result) =>
                result.type === 'listItem'
                  ? { type: 'list', children: [result] }
                  : {
                      type: 'list',
                      children: [{ type: 'listItem', ordered: false, checked: null, children: [result] }],
                    },
              ),
            );
            return [child];
          }
          return [child];
        }),
      )
    ).flat();
  }
  await Promise.all(
    plugins
      .map((p) => p['postBuild'])
      .filter(isDefined)
      .map((f) => f(node as NodeDB & { children: NodeDB[] })),
  );
  return node;
}
async function getTree(nodeId: ID): Promise<FullNode | undefined> {
  const nodeFromDB = await getNodeFromDB(nodeId);
  if (nodeFromDB === null) {
    return undefined;
  }
  const node = { ...nodeFromDB } as FullNode;
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
  if (addedNode.type !== 'text' && node.type !== 'text' && node.children) {
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
