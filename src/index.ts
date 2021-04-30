import gfm from 'remark-gfm';
import remark, { parse, stringify } from 'remark';
var markdownCompile = require('remark-stringify');
import { DB, getDb } from './db';
import flatFilter from 'unist-util-flat-filter';
import { ID, Query } from './types';
import { notEqual } from 'node:assert';
import visit from 'unist-util-visit';

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
- [ ] result should have square box at the end
- [ ] search in child nodes for AND condition
- [ ] query by AND with excludetags
- [ ] query , with exclude tag 
- [ ] query by OR
- [-] results should of siblings or children. It should behave differently in lists and other way in paragraph
- [ ] children in db should be childrenIds, and remove positions and add parent
- [ ] if query result is a list item, then show list item in the result
- [ ] will paragraph ever get children more than one ? 

- problems 
  1. [x] one result instead of two 
  2. [x] not added as child to the result 
  3. [ ] tag should not be saved with filepath

- the new flow should be: 
  - read each node
  - if its a query response, delete it
  - if it has a tag , save the tree to db along with tag
  - if it is a query, save the tree to db along with query
  - get all queries, fill with responses

- in progress: 
  - refactor addNode to clearly differentiate from saving to db and others. More to update once we get clarity
*/

const testText = `

- simple paragraph #tag
  - some other simple
  - some second child
    - another child #tag2

a paragraph #tag
- simple query +tag
  - existing data

`;
const big = `- [ ] simple **text**  for #tag
  - child elements
- query: +tag
- sime list
  - hello
  1. t1
  2. 42

# hea +results
- this is a response ◾
Some simple text #tag   

1. [ ] task 1
2. [x] task 2
`;
getDb().then((db) => {
  const s = remark()
    .use(gfm)
    .use(() => (tree: any) => {
      db.deleteAll('file1.md');
      visitNode('file1.md', tree, null, db, false, false);
      deleteQueryResults(tree);
      attachResults(tree, db);
    })
    // .use(plugin2)
    // .use(plugin, { filePath: 'file1.md', db })
    // .use(() => (tree: any) => {
    //   tree.children.forEach((nodeId: ID) => updateQueriesWithResults(nodeId, db));
    // })
    // .use(() => (tree: any) => {
    //   getNodeForChildren(tree, db);
    //   // tree.children = tree.children.map((childId: ID) => getNodeForChildren(childId, db));
    // })
    .use(markdownCompile, { listItemIndent: 'one', bullet: '-' })
    .processSync(testText)
    .toString();
  console.log(s);
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
    } else if (node.type === 'paragraph') {
      // add results to parents
      const finalResult = paraResults.flatMap((r) => [
        { type: 'paragraph', children: [{ type: 'text', value: '' }] },
        r,
      ]);
      if (listResults.length > 0) {
        // TODO : If all results are checkbox, add checkbox. if all are done, add done ?
        finalResult.push({ type: 'list', ordered: false, spread: false, children: listResults });
      }
      return finalResult;
    }
  }
  if (node.children && node.children.length > 0) {
    let childrenWithResults: any[] = [];
    node.children.forEach((child: any, index: number) => {
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
  // get it working for simple query first, to check other flow is fine
  //assuming there is only one tag always in include
  if (query?.include.length > 0) {
    const tag = db.getTagByName(query.include[0]);
    const results = tag?.references.map((nodeId: ID) => db.getNode(nodeId));
    results?.forEach((node) => getChildren(node, db));
    return results || [];
  }
  return [];
}
function updateQueriesWithResults(nodeId: ID, db: DB) {
  const node = db.getNode(nodeId) as any;
  if (!node) {
    return;
  }
  if (node.children) {
    node.children.forEach((child: ID) => updateQueriesWithResults(child, db));
  }

  if (node.queries) {
    const queryObj = db.getQuery(node.queries);

    if (!queryObj || queryObj.include.length === 0) {
      return;
    }
    // considering only AND condition for now
    const tags = [
      ...queryObj.include.map((tagName: string) => ({ tagName, include: true })),
      // ...queryObj.exclude.map((tag: string) => ({ tag, include: false })), //TODO: consider exclude too once include is fixed
    ];

    const tagResults = tags.map(({ tagName }) => db.getTagByName(tagName)?.references || []).flat();
    if (tagResults.length > 0) {
      node.queryResults = tagResults;
    }
    db.updateNode(node);

    // get results for each tag
    // if any of them exists in both, it is added by default
    // else remove the actual tag and search its children if any of them exist in other list
  }
}

function getNodeForChildren(nodeID: ID, db: DB): any | null {
  let node;
  if (typeof nodeID === 'number') {
    //TODO: make new param for childrenIds and remove this hack
    node = db.getNode(nodeID) as any;
  } else {
    node = nodeID;
  }

  if (node && node.children && node.children.length > 0) {
    node.children = node.children.map((childId: ID) => getNodeForChildren(childId, db));
    let resultId = node.children.findIndex((ch: any) => ch.queryResults !== undefined);
    while (resultId !== -1) {
      const results = node.children[resultId].queryResults.map((res: ID) => getNodeForChildren(res, db));
      node.children[resultId].queryResults = undefined;
      node.children.splice(resultId + 1, 0, ...results);
      resultId = node.children.findIndex((ch: any) => ch.queryResults !== undefined);
    }
  }

  return node;
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
  if (node.type === 'listItem') {
    nodeData = getNodeMeta(node.children[0].children);
  } else if (node.type === 'paragraph' && !ignoreChecks) {
    nodeData = getNodeMeta(node.children);
  }
  if (nodeData?.ignore) {
    node.ignore = true;
    return null;
  }
  let addedNode;
  let savedNodeId: ID | null = null;
  const doSaveNode = !!(nodeData || save);
  if (doSaveNode) {
    addedNode = saveNode(node, filePath, parentId, db);
    savedNodeId = addedNode.$loki;
    if (nodeData?.tags) {
      const tagIds = saveTag(nodeData.tags, addedNode.$loki, filePath, db);
      addedNode.tags = tagIds;
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
  if (node.children) {
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
const queryResponseRegexp = /◾$/;
const hashTagRegexp = /(\s|^)#([a-zA-Z0-9-_.]+)/g;
const queryRegexp = /(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g;
function getNodeMeta(nodes: any[]): NodeData {
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
    return { tags };
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
function parseNode(
  filePath: string,
  node: any,
  parentNode: any = undefined,
  db: DB,
): { tags?: string[]; ignore?: boolean } | undefined {
  // - read each node
  // - [x] if its a query response, delete it
  // - [ ] if it has a tag , save the tree to db along with tag
  // - [ ] if it is a query, save the tree to db along with query
  // - [ ] get all queries, fill with responses

  if (node.type === 'text') {
    let text = node.value;
    if (node.children && node.chilren.length > 0) {
      text = node.children.map((n: any) => n.value).join('');
    }
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
      return { tags };
    }
  } else if (node.type === 'listitem' || node.type === 'paragraph') {
    // take only first child for now
    if (!node.children || node.children.length === 0) {
      return {};
    }
    const nodeDetails = parseNode(filePath, node.children[0], node.type === 'listitem' ? node : undefined, db);
    const nodeToSave = (parentNode | node) as any;
    if (nodeDetails?.ignore) {
      nodeToSave.ignore = true;
    } else if (nodeDetails?.tags) {
      saveTag(filePath, nodeToSave, null, db, nodeDetails.tags);
    }
  }
}

// PROBLEM !!!! If child also has a hashtag, do not duplicate TODO: TODO: TODO:
// function saveTag(filePath: string, node: any, parentId: ID | null, db: DB, tags?: string[]): ID | undefined {
//   const nodeTosave = Object.assign(node);
//   nodeTosave.filePath = filePath;
//   nodeTosave.parentId = parentId;
//   delete nodeTosave['position'];
//   const addedNode = db.addNode(nodeTosave);

// node.filePath = filePath;
// node.parentId = parentId;

// if (node.children && node.children.some((child: any) => child.ignore)) {
//   return undefined;
// }
// const addedNode = db.addNode(node);
// if (node.children && node.children.length > 0) {
//   const newChildrenIds: ID[] = [];
//   node.children.forEach((child: any) => {
//     if (!child.ignore) {
//       const addedNodeId = addNode(child, filePath, addedNode.$loki, db);
//       if (addedNodeId) {
//         newChildrenIds.push(addedNodeId);
//       }
//     }
//   });
//   node.children = newChildrenIds;
//   addedNode.childrenIds = newChildrenIds;
// }
// if (node.tags && node.tags.length > 0) {
//   const tagIds: ID[] = [];
//   node.tags.forEach((tag: string) => {
//     const existingTag = db.getTagByName(tag);
//     if (existingTag) {
//       existingTag.references.push(addedNode.$loki);
//       db.updateTag(existingTag);
//       tagIds.push(existingTag.$loki);
//     } else {
//       const tagAdded = db.addTag(tag, filePath, [addedNode.$loki]);
//       tagIds.push(tagAdded.$loki);
//     }
//   });
//   node.tags = tagIds;
//   addedNode.tags = tagIds;
// }
// if (node.queries && (node.queries.include.length > 0 || node.queries.exclude.length > 0)) {
//   const queryAdded = db.addQuery({ ...node.queries, filePath, results: [], node: addedNode.$loki });
//   if (queryAdded) {
//     node.queries = queryAdded.$loki;
//     addedNode.queries = queryAdded.$loki;
//   }
// }
// db.updateNode(addedNode);

// return addedNode.$loki;
// }
function plugin2() {
  return (tree: any) => {
    const p: any = flatFilter(tree, (node: any) => node.type === 'paragraph' || node.type === 'heading');
    p.children.forEach((paragraph: any) => {
      paragraph.children.forEach((element: any) => {
        // if text has children , go to them
        if (
          element.type !== 'text' &&
          element.children &&
          element.children.length === 1 &&
          element.children[0].type === 'text'
        ) {
          element = element.children[0];
        }

        // ignore if its a query result

        const match = element.value.match(/◾$/);
        if (match) {
          paragraph.ignore = true;
          return;
        }
        // collect tags
        const matches = element.value.matchAll(/(\s|^)#([a-zA-Z0-9-_.]+)/g);
        const tags = [];
        for (const match of matches) {
          const tag = match[2];
          tags.push(tag);
        }
        paragraph.tags = tags;

        // collect queries
        const queryMatches = element.value.matchAll(/(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g);
        const queries: { include: string[]; exclude: string[] } = { include: [], exclude: [] };
        for (const match of queryMatches) {
          if (match[2] === '+') {
            queries.include.push(match[3]);
          } else {
            queries.exclude.push(match[3]);
          }
        }
        if (queries.include.length > 0 || queries.exclude.length > 0) {
          paragraph.queries = queries;
        }
      });
    });
  };
}
function plugin({ filePath, db }: { filePath: string; db: DB }) {
  return (tree: any) => {
    db.deleteAll(filePath); // can we somehow just update
    addNode(tree, filePath, null, db);
    // console.log(db.nodes.data);
  };
}
function addNode(node: any, filePath: string, parentId: ID | null, db: DB, tags?: string[]): ID | undefined {
  node.filePath = filePath;
  node.parentId = parentId;
  if (node.children && node.children.some((child: any) => child.ignore)) {
    return undefined;
  }
  const addedNode = db.addNode(node);
  if (node.children && node.children.length > 0) {
    const newChildrenIds: ID[] = [];
    node.children.forEach((child: any) => {
      if (!child.ignore) {
        const addedNodeId = addNode(child, filePath, addedNode.$loki, db);
        if (addedNodeId) {
          newChildrenIds.push(addedNodeId);
        }
      }
    });
    node.children = newChildrenIds;
    addedNode.childrenIds = newChildrenIds;
  }
  if (node.tags && node.tags.length > 0) {
    const tagIds: ID[] = [];
    node.tags.forEach((tag: string) => {
      const existingTag = db.getTagByName(tag);
      if (existingTag) {
        existingTag.references.push(addedNode.$loki);
        db.updateTag(existingTag);
        tagIds.push(existingTag.$loki);
      } else {
        const tagAdded = db.addTag(tag, filePath, [addedNode.$loki]);
        tagIds.push(tagAdded.$loki);
      }
    });
    node.tags = tagIds;
    addedNode.tags = tagIds;
  }
  if (node.queries && (node.queries.include.length > 0 || node.queries.exclude.length > 0)) {
    const queryAdded = db.addQuery({ ...node.queries, filePath, results: [], node: addedNode.$loki });
    if (queryAdded) {
      node.queries = queryAdded.$loki;
      addedNode.queries = queryAdded.$loki;
    }
  }
  db.updateNode(addedNode);

  return addedNode.$loki;
}
