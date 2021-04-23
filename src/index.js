"use strict";
exports.__esModule = true;
console.log('working for now');
// import { remove } from 'unist-util-remove';
// import plugin from './plugin.js';
// import * as gfm from 'remark-gfm';
var remark_gfm_1 = require("remark-gfm");
var remark_1 = require("remark");
var markdownCompile = require('remark-stringify');
var db_1 = require("./db");
db_1.getDb().then(function (db) {
    // const tree = unified()
    //   .use(parse, { extensions: [mdastUtilGfm.fromMarkdown()] })
    var s = remark_1["default"]()
        .use(remark_gfm_1["default"])
        .use(plugin2)
        // .use(plugin, { filePath: 'file1.md', db })
        .use(markdownCompile, { listItemIndent: 'one', bullet: '-' })
        .processSync("- [ ] simple **text** #tag\nquery: +tag -tag2 abc-def\n\n# hea +results\n- this is a response \u25FE\n\nSome simple text #tag   ")
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
var unist_util_flat_filter_1 = require("unist-util-flat-filter");
function plugin2() {
    return function (tree) {
        var p = unist_util_flat_filter_1["default"](tree, function (node) { return node.type === 'paragraph' || node.type === 'heading'; });
        p.children.forEach(function (paragraph) {
            paragraph.children.forEach(function (element) {
                // if text has children , go to them
                if (element.type !== 'text' &&
                    element.children &&
                    element.children.length === 1 &&
                    element.children[0].type === 'text') {
                    element = element.children[0];
                }
                // ignore if its a query result
                var match = element.value.match(/◾$/);
                if (match) {
                    // remove(tree, p);
                }
                // collect tags
                var matches = element.value.matchAll(/(\s|^)#([a-zA-Z0-9-_.]+)/g);
                var tags = [];
                for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
                    var match_1 = matches_1[_i];
                    var tag = match_1[2];
                    tags.push(tag);
                }
                paragraph.tags = tags;
                // collect queries
                var queryMatches = element.value.matchAll(/(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g);
                var queries = { include: [], exclude: [] };
                for (var _a = 0, queryMatches_1 = queryMatches; _a < queryMatches_1.length; _a++) {
                    var match_2 = queryMatches_1[_a];
                    if (match_2[2] === '+') {
                        queries.include.push(match_2[3]);
                    }
                    else {
                        queries.exclude.push(match_2[3]);
                    }
                }
                paragraph.queries = queries;
            });
        });
    };
}
