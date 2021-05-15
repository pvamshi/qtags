import { generateAddNode, generateUpdateNode } from './generate-node';
import { ID, Node, NodeDB, TextDB } from './types';
import Loki from 'lokijs';

let nodes: Collection<NodeDB> | null;

export async function addNodeToDB(node: Node, parentId?: ID): Promise<NodeDB> {
  if (!nodes) {
    await initDB();
  }
  const addedNode = nodes!.insertOne(
    node.type === 'text'
      ? ({ ...generateAddNode(node), parentId } as TextDB)
      : ({ ...generateAddNode(node), parentId, childIds: [] } as Exclude<TextDB, NodeDB>),
  ) as NodeDB | undefined;
  if (addedNode === undefined) {
    throw new Error('Error while adding node' + JSON.stringify(node));
  }
  if (addedNode.type !== 'text' && node.type !== 'text') {
    addedNode.childIds = await Promise.all(node.children.map((c: Node) => addNodeToDB(c, addedNode.$loki))).then((n) =>
      n.map((m) => m.$loki),
    );
  }
  return addedNode as NodeDB;
}
export async function updateNodeToDB(node: NodeDB): Promise<NodeDB> {
  if (!nodes) {
    await initDB();
  }
  return nodes!.update(generateUpdateNode(node) as NodeDB);
}
export async function getNodeFromDB(nodeId: ID): Promise<NodeDB> {
  if (!nodes) {
    await initDB();
  }
  return nodes!.findOne({ $loki: nodeId }) as NodeDB;
}

export async function queryForNode<T>(query: LokiQuery<T>) {
  if (!nodes) {
    await initDB();
  }
  return nodes!.find(query);
}

export async function deleteNodeFromDB(node: NodeDB) {
  if (!nodes) {
    await initDB();
  }

  if (node.type !== 'text') {
    nodes!.removeWhere({ $loki: { $in: node.childIds } });
  }
  nodes!.remove(node);
}
async function initDB(): Promise<{
  nodes: Collection<any>;
  // tags: Collection<Tag>;
  // queries: Collection<Query>;
}> {
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
