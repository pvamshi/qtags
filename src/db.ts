import Loki from 'lokijs';

import { generateUpdateNode } from './generate-node';
import { ID, NodeDB, Query, QueryDB, Tag, TagDB } from './types';

let nodes: Collection<NodeDB> | null;
let tags: Collection<TagDB> | null | undefined;
let queries: Collection<QueryDB> | null;

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

  nodes!.remove(node);
}

export async function getTagFromDB(tagName: string): Promise<TagDB | null> {
  if (!tags) {
    await initDB();
  }
  return tags!.findOne({ name: tagName });
}

export async function getTagsForNode(nodeId: ID) {
  if (!tags) {
    return [];
  }

  return tags.find({ references: { $contains: nodeId } });
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

export async function deleteTag(tag: TagDB) {
  if (!tags) {
    return;
  }
  return tags.remove(tag);
}

export async function addQueryToDB(query: Query): Promise<QueryDB> {
  if (!queries) {
    await initDB();
  }
  const addedQuery = queries!.insertOne(query as QueryDB);
  if (!addedQuery) {
    console.error('failed to add query');
    throw new Error('failed to add query');
  }
  return addedQuery;
}
export async function getQueryFromDB(queryId: ID): Promise<QueryDB | null> {
  if (!queries) {
    await initDB();
  }
  return queries!.findOne({ $loki: queryId });
}

export async function searchForQuery(hash: string) {
  if (!queries) {
    await initDB();
  }
  return queries!.findOne({ hash });
}
export async function updateQueryInDB(query: QueryDB) {
  if (!queries) {
    await initDB();
  }
  return queries!.update(query);
}
export async function deleteQueryFromDB(queryId: ID) {
  if (!queries) {
    return;
  }
  return queries!.removeWhere({ $loki: queryId });
}

export async function getQueryForNode(nodeId: ID): Promise<QueryDB | null> {
  if (!queries) {
    await initDB();
  }
  return queries!.findOne({ node: nodeId });
}

async function initDB(): Promise<{
  nodes: Collection<any>;
  tags: Collection<TagDB>;
  queries: Collection<QueryDB>;
}> {
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
          queries = db.getCollection('queries');
          if (queries === null) {
            queries = db.addCollection('queries');
          }
          // if (tags && nodes && queries) {
          if (nodes) {
            resolve({ nodes, tags, queries });
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
