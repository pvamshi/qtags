console.log('working for now');
// import { remove } from 'unist-util-remove';
// import plugin from './plugin.js';

// import * as gfm from 'remark-gfm';
import gfm from 'remark-gfm';
import remark from 'remark';
var markdownCompile = require('remark-stringify');
import { getDb } from './db';

getDb().then((db) => {
  // const tree = unified()
  //   .use(parse, { extensions: [mdastUtilGfm.fromMarkdown()] })
  const s = remark()
    .use(gfm)
    .use(plugin2)
    // .use(plugin, { filePath: 'file1.md', db })
    .use(markdownCompile, { listItemIndent: 'one', bullet: '-' })
    .processSync(
      `- [ ] simple **text** #tag
query: +tag -tag2 abc-def

# hea +results
- this is a response ◾

Some simple text #tag   `,
    )
    .toString();
  console.log(s);
});

/* 
// TODO 
- [x] add queries 
- [x]task is saved as `[ ] task `
- [ ] detect query result and ignore it
- [ ] While saving  replace children with their ids and tags with their ids
- [ ] add backlinks to tags and queries
- [ ] Fetch query results for this file instantly
- [ ] check if any other file needs to be updated
*/
import flatFilter from 'unist-util-flat-filter';

function plugin2() {
  return (tree: any) => {
    const p = flatFilter(tree, (node: any) => node.type === 'paragraph' || node.type === 'heading');
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
          // remove(tree, p);
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
        paragraph.queries = queries;
      });
    });
  };
}
