import remark from 'remark';
import gfm from 'remark-gfm';
import chokidar from 'chokidar';

import { DB, getDb } from './db';
import { ID, Query } from './types';
import { updateDB } from './diff';

var vfile = require('to-vfile');
var markdownCompile = require('remark-stringify');
var toMarkdown = require('mdast-util-to-markdown');

let ignoreFiles: string[] = []; // hack to ignore just saved file
getDb().then((db) => {
  chokidar.watch('/Users/vamshi/Dropbox/life/**/*.md').on('change', (filePath) => {
    const a = new Date().getTime() + '';
    let filesToUpdate = [];
    console.time(a);
    if (ignoreFiles[0] === filePath) {
      ignoreFiles.shift();
      return;
    }
    const processor = remark()
      .use(gfm)
      .use(() => (tree: any) => {
        try {
          db.deleteAll(filePath); // TODO: if we are updaing query , is it ok to delete ?
          // updateDB(tree, filePath, db);
          visitNode(filePath, tree, null, db, true, false);
          deleteQueryResults(tree);
          attachResults(tree, db);
          orderTasks(tree);
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
      console.timeEnd(a);
    });
    // hack to print tree from memory
    // remark()
    //   .use(gfm)
    //   .use(() => (tree) => {
    //     console.log({ tree });
    //     const newtree = log(
    //       db.nodes.findOne({ type: 'root', filePath: '/Users/vamshi/Dropbox/life/test.md' })?.$loki,
    //       db,
    //     );
    //     tree.children = newtree.children;
    //   })
    //   .use(markdownCompile, {
    //     listItemIndent: 'one',
    //     bullet: '-',
    //     rule: '_',
    //     join: () => 1,
    //   })
    //   .process('', (er, ff) => console.log(ff.contents.replaceAll('\\', '')));
  });
});

function log(nodeID: ID | undefined, db: DB): any {
  if (!nodeID) {
    return null;
  }
  const node = db.getNode(nodeID);
  if (node?.childIds) {
    node.children = node.childIds.map((id: ID) => log(id, db)).filter((n: any) => !!n);
  }
  return node;
}
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
      node.children = node.children
        .concat(listResults)
        .concat(paraResults.map((para: any) => ({ type: 'listItem', children: [para] })));
      return [];
    } else if (node.type === 'paragraph' || node.type === 'heading') {
      if (listResults.length > 0) {
        paraResults.push({ type: 'list', ordered: false, spread: false, children: listResults });
      }
      return paraResults;
    }
  }
  if (node.children && node.children.length > 0) {
    let childrenWithResults: any[] = [];
    node.children.forEach((child: any) => {
      const childResults = attachResults(child, db);
      // console.log({ c: JSON.stringify(node) });
      childrenWithResults =
        childResults.length > 0
          ? childrenWithResults.concat([child, ...childResults])
          : childrenWithResults.concat([child]);
    });
    node.children = childrenWithResults;
  }
  return [];
}

function getChildren(node: any, exclude: string[], db: DB) {
  if (node.childIds) {
    node.children = node.childIds
      .map((childID: ID) => db.getNode(childID, true))
      .filter((child: any) => !child.tags || child.tags.every((tag: string) => !exclude.includes(tag)));
    node.children.forEach((child: any) => {
      getChildren(child, exclude, db);
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
    const uresults = results.flatMap((result: any) =>
      result.type === 'listItem' ? replaceParentIfHashOnly(result, query.exclude, db) : [result],
    );

    uresults.forEach((node: any) => {
      getChildren(node, query.exclude, db);
      let para: any;
      if (node.type === 'paragraph') {
        para = node;
      } else if (node.type === 'listItem') {
        para = node.children[0];
      }
      if (para) {
        const fileName = node.filePath.split('/').pop();
        const fileString = fileName ? ` [·](${fileName})` : '';
        para.children.push({ type: 'text', value: `${fileString}·` });
      }
    });
    return uresults || [];
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
      localTags.push('todo');
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

/**
 * 
 If the hash is of the form 
  - #tag1
    - child 1
    - child 2
  we dont want to include parent in the result. It would be clean
 */
function replaceParentIfHashOnly(node: any, exclude: string[], db: DB) {
  if (!node.childIds || node.childIds.length === 0) {
    return [node];
  }
  const paragraph = db.getNode(node.childIds[0]) as any;
  const text = paragraph.childIds.map((t: any) => db.getNode(t).value).join('');
  if (text.split(' ').filter((w: string) => !w.startsWith('#')).length === 0) {
    // it only contains hashes, instead of child, add its children
    return node.childIds
      .slice(1) // remove paragraph child
      .map((childID: ID) => db.getNode(childID)) // get all list nodes
      .filter((n: any) => !!n) // filter out invalid
      .flatMap((list: any) => (list.childIds || []).map((childId: ID) => db.getNode(childId))) // get all children
      .filter((child: any) => !child.tags || child.tags.every((tag: string) => !exclude.includes(tag))); // make sure they dont have exclude tag
  } else {
    return [node];
  }
}
