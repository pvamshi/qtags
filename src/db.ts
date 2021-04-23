import Loki from 'lokijs';

import { BaseNode, ElementNode, ElementNodeDoc, File, ID, Tag } from './types';

export interface DB {
  getNode(id: ID): ElementNode;
  addNode<T>(node: T & { children?: ID[] }): T;
  deleteNode(nodeId: ID): void;
  updateNode(node: ElementNodeDoc): void;
  getFile(filePath: string): (File & LokiObj) | undefined;
  addTag(name: string, filePath: string, references?: ID[]): Tag & LokiObj;
  addRefToTag(name: string, filePath: string, nodeId: ID): Tag & LokiObj;
  unlinkFileToTag(filePath: string): void;
  tags: Collection<Tag>;
  nodes: Collection<ElementNode>;
}

export async function getDb(): Promise<DB> {
  const { nodes, tags } = await initDB();
  const getNode = ($loki: ID) => nodes.findOne({ $loki }) as ElementNode;
  const addNode = <T>(node: T) => nodes.insertOne(node) as T;
  const deleteNode = (nodeId: ID) => nodes.removeWhere({ $loki: nodeId });
  const addTag = (name: string, filePath: string, references: ID[] = []) =>
    tags.insertOne({ name, filePath, references, queries: [] }) as Tag & LokiObj;

  const addRefToTag = (name: string, filePath: string, nodeId: ID): Tag & LokiObj => {
    let tag: Tag & LokiObj = tags.findOne({ name, filePath }) as Tag & LokiObj;
    if (!tag) {
      tag = addTag(name, filePath, [nodeId]) as Tag & LokiObj;
    } else {
      tag.references.push(nodeId);
      tags.update(tag);
    }
    return tag;
  };

  const addQuery = () => {};

  const unlinkFileToTag = (filePath: string) => {
    tags.removeWhere({ filePath });
  };

  const updateNode = (node: ElementNodeDoc) => {
    nodes.update(node);
  };
  return {
    getNode,
    addNode,
    deleteNode,
    updateNode,
    getFile: getFile(nodes),
    addTag,
    addRefToTag,
    unlinkFileToTag,
    tags,
    nodes,
  };
}
export async function initDB(): Promise<{
  nodes: Collection<any>;
  tags: Collection<Tag>;
}> {
  let nodes: Collection<ElementNode> | null;
  let tags: Collection<Tag> | null;
  return new Promise((resolve, reject): void => {
    try {
      const db = new Loki('qtags.db', {
        autoload: true,
        autoloadCallback: () => {
          nodes = db.getCollection('nodes');
          if (nodes === null) {
            nodes = db.addCollection('nodes');
          }
          tags = db.getCollection('tags');
          if (tags === null) {
            tags = db.addCollection('tags', { indices: ['name', 'filePath'] });
          }
          if (tags && nodes) {
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

function getFile(nodes: Collection<ElementNode>) {
  return function (filePath: string): (File & LokiObj) | undefined {
    return nodes.findOne({ filePath }) as (File & LokiObj) | undefined;
  };
}
