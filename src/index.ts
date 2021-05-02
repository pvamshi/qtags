import remark from 'remark';
import gfm from 'remark-gfm';
import chokidar from 'chokidar';

import { DB, getDb } from './db';
import { ID, Query } from './types';

var vfile = require('to-vfile');
var markdownCompile = require('remark-stringify');
/* 
// TODO 
- [x] add queries 
- [x]task is saved as `[ ] task `
- [x] detect query result and ignore it
- [x] While saving  replace children with their ids and tags with their ids
- [x] add backlinks to tags and queries
- [x] Fetch query results for this file instantly
- [-] check if any other file needs to be updated
- [ ] Run this script when a file is open
- [x] convert back to markdown
- [x] result should have square box at the end
- [ ] search in child nodes for AND condition
- [x] query by AND with excludetags
- [x] query , with exclude tag 
- [ ] query by OR
- [-] results should of siblings or children. It should behave differently in lists and other way in paragraph
- [x] children in db should be childrenIds, and remove positions and add parent
- [x] if query result is a list item, then show list item in the result
- [x] will paragraph ever get children more than one ? 

- problems 
  1. [x] one result instead of two 
  2. [x] not added as child to the result 
  3. [x] tag should not be saved with filepath

- the new flow should be: 
  - read each node
  - if its a query response, delete it
  - if it has a tag , save the tree to db along with tag
  - if it is a query, save the tree to db along with query
  - get all queries, fill with responses

- in progress: 
  - refactor addNode to clearly differentiate from saving to db and others. More to update once we get clarity
*/

let ignoreFiles: string[] = []; // hack to ignore just saved file
getDb().then((db) => {
  chokidar.watch('/Users/vamshi/Dropbox/life/**/*.md').on('change', (filePath) => {
    if (ignoreFiles[0] === filePath) {
      ignoreFiles.shift();
      return;
    }
    const processor = remark()
      .use(gfm)
      .use(() => (tree: any) => {
        try {
          const a = new Date().getTime() + '';
          console.time(a);
          db.deleteAll(filePath);
          visitNode(filePath, tree, null, db, false, false);
          deleteQueryResults(tree);
          attachResults(tree, db);
          orderTasks(tree);
          console.timeEnd(a);
        } catch (e) {
          console.error(e);
        }
      })
      .use(markdownCompile, {
        listItemIndent: 'one',
        bullet: '-',
        rule: '_',
        join: () => 1,
      });
    processor.process(vfile.readSync(filePath), function (error, file) {
      if (error) throw error;
      // file.contents = file.contents.replaceAll('- \\[', '- [').replaceAll(/^\\\+/g, '+');
      file.contents = file.contents.replaceAll('\\', '').replaceAll('\n<!---->\n\n', ''); // <!----> happens when query added in header
      vfile.writeSync(file);
      ignoreFiles.unshift(filePath);
    });
  });
});

function deleteQueryResults(node: any) {
  if (node.children) {
    const initialLength = node.children.length;
    node.children.forEach((child: any) => deleteQueryResults(child));
    node.children = node.children.filter((child: any) => !child.ignore);
    if (node.type === 'list' && node.children.length === 0 && initialLength !== 0) {
      // there were some results
      node.ignore = true;
    }
  }
}

function attachResults(node: any, db: DB): any[] {
  if (node.query) {
    // const query: Query | null = db.getQuery(node.queryId);
    // if (query === null) {
    //   return [];
    // }
    const queryResults = getResults(node.query, db);

    const listResults = queryResults.filter((r: any) => r.type === 'listItem');
    const paraResults = queryResults.filter((r: any) => r.type === 'paragraph');
    if (node.type === 'listItem') {
      //convert paragraph to listitem
      node.children = node.children.concat(
        listResults.concat(paraResults.map((para: any) => ({ type: 'listItem', children: [para] }))),
      );
      return [];
    } else if (node.type === 'paragraph' || node.type === 'heading') {
      // add results to parents
      // const finalResult = paraResults.flatMap((r) => [
      //   { type: 'paragraph', children: [{ type: 'text', value: '' }] },
      //   r,
      // ]);
      if (listResults.length > 0) {
        // TODO : If all results are checkbox, add checkbox. if all are done, add done ?
        paraResults.push({ type: 'list', ordered: false, spread: false, children: listResults });
      }
      return paraResults;
    }
  }
  if (node.children && node.children.length > 0) {
    let childrenWithResults: any[] = [];
    node.children.forEach((child: any) => {
      const childResults = attachResults(child, db);
      childrenWithResults =
        childResults.length > 0
          ? childrenWithResults.concat([child, ...childResults])
          : childrenWithResults.concat([child]);
    });
    node.children = childrenWithResults;
  }
  return [];
}

function getChildren(node: any, db: DB) {
  if (node.childIds) {
    node.children = node.childIds.map((childID: ID) => db.getNode(childID));
    node.children.forEach((child: any) => {
      getChildren(child, db);
    });
  }
}
function getResults(query: Query, db: DB): any[] {
  if (query?.include.length > 0) {
    const tagName = query.include[0];
    const restOfTags = query.include.slice(1);
    const tags = db.getAllTagByName(tagName);
    const exactmatches =
      tags?.flatMap((tag) =>
        tag.references
          .map((nodeId: ID) => db.getNode(nodeId))
          .filter((node: any) => !node.tags.some((tag: string) => query.exclude.includes(tag)))
          .filter((node: any) => restOfTags.every((tag) => node.tags.includes(tag))),
      ) || [];

    const results = query.include
      .flatMap((tag) =>
        db
          .getAllTagByName(tag)
          ?.flatMap((tagOb) =>
            tagOb.references
              .map((refId: ID) => db.getNode(refId))
              .flatMap((node: any) =>
                queryTags(
                  { include: query.include.filter((t) => t !== tagOb.name), exclude: query.exclude },
                  node,
                  exactmatches,
                  db,
                ),
              ),
          ),
      )
      .reduce(
        (res, curr) => (res.filter((r: any) => r.$loki === curr.$loki).length > 0 ? res : res.concat([curr])),
        [],
      );
    results.forEach((node: any) => {
      getChildren(node, db);
      let para: any;
      if (node.type === 'paragraph') {
        para = node;
      } else if (node.type === 'listItem') {
        para = node.children[0];
      }
      if (para) {
        const fileName = node.filePath.split('/').pop();
        const fileString = fileName ? ` [${fileName}](${fileName})` : '';
        para.children.push({ type: 'text', value: `${fileString} ·` });
      }
    });
    return results || [];
  }
  return [];
}

type NodeData = { tags?: string[]; ignore?: boolean; query?: { include: string[]; exclude: string[] } } | undefined;

function isIgnoreChecks(node: any, nodeData: NodeData, index: number): boolean {
  return (node.type === 'paragraph' && index === 0 && !!nodeData) || (node.type === 'listItem' && index === 0);
}
function visitNode(
  filePath: string,
  node: any,
  parentId: ID | null,
  db: DB,
  save: boolean,
  ignoreChecks: boolean,
): ID | null {
  let nodeData: NodeData;
  let localTags: string[] = [];
  if (node.type === 'listItem' && node.children) {
    if (node.checked !== null) {
      localTags.push('task');
      if (node.checked === true) {
        localTags.push('done');
      }
    }
    nodeData = getNodeMeta(node.children[0].children);
  } else if (node.type === 'paragraph' && !ignoreChecks) {
    nodeData = getNodeMeta(node.children);
  } else if (node.type === 'heading') {
    nodeData = getNodeMeta(node.children);
  }
  if (nodeData?.ignore) {
    node.ignore = true;
    return null;
  }
  let addedNode;
  let savedNodeId: ID | null = null;
  const doSaveNode = !!(nodeData || save || localTags.length > 0);
  if (doSaveNode) {
    addedNode = saveNode(node, filePath, parentId, db);
    savedNodeId = addedNode.$loki;
    if (nodeData?.tags || localTags.length > 0) {
      const totalTags = [...(nodeData?.tags || []), ...localTags];
      saveTag(totalTags, addedNode.$loki, filePath, db);
      addedNode.tags = totalTags;
      db.updateNode(addedNode);
    }
    if (nodeData?.query) {
      const query = db.addQuery({
        filePath,
        node: addedNode.$loki,
        include: nodeData.query.include,
        exclude: nodeData.query.exclude,
        results: [],
      });
      addedNode.queryId = query;
      db.updateNode(addedNode);
      node.query = query;
    }
  }
  if (node?.children) {
    const childNodes: (ID | null)[] = [];
    node.children.forEach((child: any, index: number) => {
      childNodes.push(
        visitNode(filePath, child, savedNodeId, db, doSaveNode, ignoreChecks || isIgnoreChecks(node, nodeData, index)),
      );
    });
    if (doSaveNode) {
      addedNode.childIds = childNodes;
      db.updateNode(addedNode);
    }
  }
  return savedNodeId || null;
}

function saveNode(node: any, filePath: string, parentId: ID | null, db: DB) {
  const nodeObj = { ...node, filePath, parentId };
  delete nodeObj['position'];
  delete nodeObj['children'];
  return db.addNode(nodeObj);
}
function saveTag(tags: string[], nodeId: ID, filePath: string, db: DB) {
  const addedTags: ID[] = [];
  tags.forEach((tag) => {
    const existingTag = db.getTagByName(tag, filePath);
    if (!existingTag) {
      const newTag = db.addTag(tag, filePath, [nodeId]);
      addedTags.push(newTag.$loki);
    } else {
      existingTag.references.push(nodeId);
      addedTags.push(existingTag.$loki);
    }
  });
  return addedTags;
}
function getNodeMeta(nodes: any[]): NodeData {
  const queryResponseRegexp = /𖥔|·$/;
  const hashTagRegexp = /(\s|^)#([a-zA-Z0-9-_.]+)/g;
  const queryRegexp = /(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g;

  const text = nodes.map((n: any) => n.value).join('');
  if (text.match(queryResponseRegexp)) {
    return { ignore: true };
  }

  const hashTagMatches = text.matchAll(hashTagRegexp);
  const tags = [];
  for (const match of hashTagMatches) {
    const tag = match[2];
    tags.push(tag);
  }
  if (tags.length > 0) {
    return { tags: plugins.filter((p) => p.parse).reduce((tags, { parse }) => parse(tags), tags) };
  }

  const queryTagMatches = text.matchAll(queryRegexp);
  const queryTags: { include: string[]; exclude: string[] } = { include: [], exclude: [] };

  for (const match of queryTagMatches) {
    if (match[2] === '+') {
      queryTags.include.push(match[3]);
    } else {
      queryTags.exclude.push(match[3]);
    }
  }
  if (queryTags.include.length > 0 || queryTags.exclude.length > 0) {
    return { query: queryTags };
  }
}

const plugins = [
  {
    name: 'calendar',
    parse: (tags: string[]) => {
      // today
      if (tags.includes('today')) {
        tags = tags.filter((tag: string) => tag !== 'today');
        tags.push(new Date().toISOString().slice(0, 10) as string);
      }
      if (tags.includes('tomorrow')) {
        tags = tags.filter((tag: string) => tag !== 'tomorrow');
        tags.push(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) as string);
      }
      return tags;
    },
  },
  {
    name: 'ignoreCase',
    parse: (tags: string[]) => {
      return tags.map((tag) => tag.toLowerCase());
    },
  },
];

function orderTasks(node: any) {
  if (node.type === 'list' && node.children && node.children.length > 0) {
    node.children = [
      ...node.children.filter((list: any) => list.checked === null),
      ...node.children.filter((list: any) => list.checked === false),
      ...node.children.filter((list: any) => list.checked === true),
    ];
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach(orderTasks);
  }
}

/*
- [ ] Filter our children, which fail the exclude criteria
*/
function queryTags({ include, exclude }: { include: string[]; exclude: string[] }, node: any, results: any[], db: DB) {
  if (include.length === 0) {
    return results;
  }
  if (node.childIds && node.childIds.length > 0) {
    node.childIds.forEach((childId: ID) => {
      const child = db.getNode(childId) as any;
      if (child.tags && child.tags.length > 0) {
        if (exclude.length > 0 && child.tags.some((tag: string) => exclude.includes(tag))) {
          return results; // it has an excluded tag
        }
        const commonTags = child.tags.filter((tag: string) => include.includes(tag));
        const leftOverTags = include.filter((tag) => !commonTags.includes(tag));
        if (leftOverTags.length === 0) {
          results.push(child);
          return results;
        } else {
          return queryTags({ include: leftOverTags, exclude }, child, results, db);
        }
      } else {
        return queryTags({ include, exclude }, child, results, db);
      }
    });
  }
  return results;
}

// function intersection(list1: string[], list2: string[]) {
//   return list1.filter((el) => list2.includes(el));
// }
