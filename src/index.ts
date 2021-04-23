import plugin from './plugin';

import gfm from 'remark-gfm';
import remark from 'remark';
var markdownCompile = require('remark-stringify');
import { DB, getDb } from './db';
import flatFilter from 'unist-util-flat-filter';
import { ID } from './types';

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
- [ ] results should of siblings or children. It should behave differently in lists and other way in paragraph
- [ ] results should contain list item embedded in a list
- [ ] children in db should be childrenIds, and remove positions and add parent
- [ ] if query result is a list item, then show list item in the result

- problems 
  1. [x] one result instead of two 
  2. [ ] not added as child to the result 
  3. [ ] tag should not be saved with filepath
*/

getDb().then((db) => {
  const s = remark()
    .use(gfm)
    .use(plugin2)
    .use(plugin, { filePath: 'file1.md', db })
    .use(() => (tree: any) => {
      tree.children.forEach((nodeId: ID) => updateQueriesWithResults(nodeId, db));
    })
    .use(() => (tree: any) => {
      getNodeForChildren(tree, db);
      // tree.children = tree.children.map((childId: ID) => getNodeForChildren(childId, db));
    })
    .use(markdownCompile, { listItemIndent: 'one', bullet: '-' })
    .processSync(
      `- [ ] simple **text**  for #tag
query: +tag

# hea +results
- this is a response ◾
Some simple text #tag   

1. [ ] task 1
2. [x] task 2
`,
    )
    .toString();
  console.log(s);
});

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

    console.log({ node });
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
    console.log({ resultId });
    while (resultId !== -1) {
      console.log({ resultId });
      const results = node.children[resultId].queryResults.map((res: ID) => getNodeForChildren(res, db));
      node.children[resultId].queryResults = undefined;
      node.children.splice(resultId + 1, 0, ...results);
      resultId = node.children.findIndex((ch: any) => ch.queryResults !== undefined);
    }
  }

  return node;
}
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
