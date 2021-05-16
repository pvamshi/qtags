import Loki from 'lokijs';

import { generateUpdateNode } from './generate-node';
import { ID, NodeDB, Tag, TagDB } from './types';

let nodes: Collection<NodeDB> | null;
let tags: Collection<TagDB> | null | undefined;

export async function addNodeToDB(node: NodeDB): Promise<NodeDB> {
  if (!nodes) {
    await initDB();
  }
  const addedNode = nodes!.insertOne(node);
  if (addedNode === undefined) {
    throw new Error('Error while adding node' + JSON.stringify(node));
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

export async function getTagFromDB(tagName: string): Promise<TagDB | null> {
  if (!tags) {
    await initDB();
  }
  return tags!.findOne({ name: tagName });
}

export async function addTagToDB(tag: Tag): Promise<TagDB> {
  // TODO: seperate them to different db
  if (!tags) {
    await initDB();
  }
  const addedTag = tags!.insertOne(tag as TagDB);
  if (!addedTag) {
    throw new Error('error while adding tag');
  }
  return addedTag;
}

export async function updateTag(tag: TagDB): Promise<TagDB> {
  if (!tags) {
    await initDB();
  }
  return tags!.update(tag);
}
async function initDB(): Promise<{
  nodes: Collection<any>;
  tags: Collection<Tag>;
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
          tags = db.getCollection('tags');
          if (tags === null) {
            tags = db.addCollection('tags', { indices: ['name'] });
          }
          // queries = db.getCollection('queries');
          // if (queries === null) {
          //   queries = db.addCollection('queries', { indices: ['filePath'] });
          // }
          // if (tags && nodes && queries) {
          if (nodes) {
            resolve({ nodes, tags });
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
