import remark from 'remark';
import gfm from 'remark-gfm';
var markdownCompile = require('remark-stringify');
import { Node, Root } from './types';

export async function parse(text: string): Promise<Root & { children: Node[] }> {
  return new Promise((resolve, reject) => {
    remark()
      .use(gfm)
      .use(function () {
        this.Compiler = (tree: any) => JSON.stringify(tree);
      })
      .process(text, function (error, file) {
        if (error) reject(error);
        resolve(JSON.parse(file.contents as string));
      });
  });
}

export async function compile(newtree: any) {
  return new Promise((resolve, reject) => {
    remark()
      .use(gfm)
      .use(() => (tree) => {
        tree.children = newtree.children;
      })
      .use(markdownCompile, {
        listItemIndent: 'one',
        bullet: '-',
        rule: '_',
        join: () => 1,
      })
      .process('', (er, ff) => (er ? reject(er) : resolve(ff.contents)));
  });
}
