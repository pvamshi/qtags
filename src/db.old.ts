import Loki from 'lokijs';
const jsonfile = require('jsonfile');

import { Query, ElementNode, ElementNodeDoc, File, ID, Tag } from './types';

export interface DB {
  getNode(id: ID, copy?: boolean): any;
  addNode(node: any): any;
  deleteNode(nodeId: ID | undefined): void;
  updateNode(node: any): void;
  getFile(filePath: string): (File & LokiObj) | undefined;
  addQuery(query: Query): (Query & LokiObj) | undefined;
  getQuery(queryId: ID): (Query & LokiObj) | null;
  addTag(name: string, filePath: string, references?: ID[]): Tag & LokiObj;
  addRefToTag(name: string, filePath: string, nodeId: ID): Tag & LokiObj;
  unlinkFileToTag(filePath: string): void;
  tags: Collection<Tag>;
  nodes: Collection<ElementNode>;
  deleteAll(filePath: string): void;
  getTagByName(tagName: string, filePath?: string): (Tag & LokiObj) | null;
  getAllTagByName(tagName: string): (Tag & LokiObj)[] | null;
  updateTag(tag: Tag & LokiObj): void;
}

export async function getDb(): Promise<DB> {
  const { nodes, tags, queries } = await initDB();
  const getNode = ($loki: ID, copy?: boolean) => {
    const node = nodes.findOne({ $loki }) as any;
    if (copy) {
      return Object.assign({}, node);
    }
    return node;
  };
  const addNode = <T>(node: T) => {
    if (node.children) {
      console.log('add', node.children);
    }
    return nodes.insertOne(node) as T;
  };
  const deleteNode = (nodeId: ID | undefined) => nodes.removeWhere({ $loki: nodeId });
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

  const unlinkFileToTag = (filePath: string) => {
    tags.removeWhere({ filePath });
  };

  const updateNode = (node: ElementNodeDoc) => {
    if (node.children) {
      console.log('update', { c: node.children });
    }
    nodes.update(node);
  };
  return {
    getNode,
    addNode,
    deleteNode,
    updateNode,
    getFile: getFile(nodes),
    addQuery: addQuery(queries),
    addTag,
    addRefToTag,
    unlinkFileToTag,
    tags,
    nodes,
    deleteAll: deleteAll(nodes, tags, queries),
    getQuery: getQuery(queries),
    updateTag: updateTag(tags),
    getTagByName: getTagByName(tags),
    getAllTagByName: getAllTagByName(tags),
  };
}
function deleteAll(nodes: Collection<any>, tags: Collection<Tag>, queries: Collection<Query>) {
  return (filePath: string) => {
    nodes.removeWhere({ filePath });
    tags.removeWhere({ filePath });
    queries.removeWhere({ filePath });
  };
}
function addQuery(queries: Collection<Query>) {
  return (query: Query): (Query & LokiObj) | undefined => {
    return queries.insertOne(query);
  };
}
export async function initDB(): Promise<{
  nodes: Collection<any>;
  tags: Collection<Tag>;
  queries: Collection<Query>;
}> {
  let nodes: Collection<ElementNode> | null;
  let tags: Collection<Tag> | null;
  let queries: Collection<Query> | null;
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
            tags = db.addCollection('tags', { indices: ['name', 'filePath'] });
          }
          queries = db.getCollection('queries');
          if (queries === null) {
            queries = db.addCollection('queries', { indices: ['filePath'] });
          }
          if (tags && nodes && queries) {
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

function getFile(nodes: Collection<ElementNode>) {
  return function (filePath: string): (File & LokiObj) | undefined {
    return nodes.findOne({ type: 'root', filePath }) as (File & LokiObj) | undefined;
  };
}

function getQuery(queries: Collection<Query>) {
  return (queryId: ID): (Query & LokiObj) | null => {
    return queries.findOne({ $loki: queryId });
  };
}

function getTagByName(tags: Collection<Tag>) {
  return (tagName: string, filePath: string): (Tag & LokiObj) | null => {
    return filePath ? tags.findOne({ name: tagName, filePath }) : tags.findOne({ name: tagName });
  };
}

function getAllTagByName(tags: Collection<Tag>) {
  return (tagName: string): (Tag & LokiObj)[] | null => {
    return tags.find({ name: tagName });
  };
}
function updateTag(tags: Collection<Tag>) {
  return (tag: Tag & LokiObj) => {
    tags.update(tag);
  };
}

export function newDB() {
  return jsonfile.readFile('q4.json').then(({ data: copy }: { data: any[] }) => {
    const data = [...copy];
    return {
      getAll: () => {
        return data;
      },
      getNode: (index: number) => {
        return Object.assign({}, data[index]);
      },
      addNode: (obj: any) => {
        console.log('add', obj);
        const index = data.length;
        data.push(Object.freeze({ $loki: index, ...obj }));
        return data[index];
      },
      updateNode: (obj: any) => {
        console.log('update', obj, obj.$loki);

        if (obj.$loki !== undefined) {
          data[obj.$loki] = Object.freeze(obj);
          return data[obj.$loki];
        } else {
          console.error('could not find item for index', obj.$loki);
        }
      },
    };
  });
}
