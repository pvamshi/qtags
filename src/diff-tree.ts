import { ListItemLayout } from 'antd/lib/list';
import { getNodeFromDB, getQueryFromDB, searchForQuery } from './db';
import { plugins } from './plugins';
import { FullNode, ID, isLeaf, Node, NodeDB, TextDB, ListItem, Paragraph, ListItemDB } from './types';
import { runSerialReduce, toHash } from './utils';
import { isDefined } from 'src/plugins';
import { BackTopProps } from 'antd/lib/back-top';

function isQuery(node: ListItem | Paragraph, parent: Node) {
  if (parent.type === 'listItem') return false;
  const paragraph = node.type === 'listItem' ? (node.children[0] as Paragraph) : node;
  const text = paragraph.children.map((t) => t.value).join('');
  return /(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g.test(text);
}
function ignoreQueryResult(node: Node) {
  if (node.type === 'listItem' && node.children[0].type === 'paragraph') {
    const paragraph = node.children[0];
    if (paragraph.children[paragraph.children.length - 1]?.value.endsWith('·')) {
      return true;
    }
    return false;
  } else if (node.type === 'paragraph' && node.children[node.children.length - 1]?.value.endsWith('·')) {
    return true;
  }
  return false;
}

function toString(node: Node): string {
  if (!node) {
    return '';
  }
  switch (node.type) {
    case 'listItem':
      return toHash(JSON.stringify({ checked: node.checked, children: node.children.map(toString) }));

    case 'text':
      return node.value;

    case 'heading':
      return toHash(JSON.stringify({ depth: node.depth, children: node.children.map(toString) }));
    case 'root':
      return '';

    case 'paragraph':
    case 'list':
    default:
      return isLeaf(node) ? node.value || '' : toHash(node.children.map(toString).join(''));
  }
}

function diffChildren(news: string[], old: string[]) {
  const a1 = new Set(old);
  const a2 = new Set(news);
  const unique = (arr: string[], a: Set<string>): string[] => arr.filter((x) => !a.has(x)); //.map((s) => indexFromString(s));
  const unique1 = unique(old, a2);
  const unique2 = unique(news, a1);
  const deletions = unique1.filter((n) => !unique2.includes(n)).map((s) => old.indexOf(s));
  const additions = unique2.filter((n) => !unique1.includes(n)).map((s) => news.indexOf(s));
  // return { additions, deletions };
  const updates = additions.filter((d) => deletions.includes(d));
  return {
    updates,
    additions: additions.filter((a) => !updates.includes(a)),
    deletions: deletions.filter((a) => !updates.includes(a)),
  };
}

/**
 *
 */
export async function diffTree(
  oldNode: FullNode | undefined,
  parentId: ID | undefined,
  newNode: Node & { children?: Node[] },
  {
    addNode,
    deleteNode,
    updateNode,
  }: {
    addNode: (node: Node, parentId: ID | undefined) => Promise<NodeDB | null>;
    updateNode: (node: NodeDB) => Promise<NodeDB>;
    deleteNode: (nodeId: ID) => void;
  },
  queryResult?: boolean,
) {
  if (!oldNode) {
    await addNode(newNode, parentId);
  } else if (oldNode !== undefined && oldNode.type !== newNode.type) {
    await addNode(newNode, parentId);
    deleteNode(oldNode.$loki);
  } else if (oldNode.type === 'text' && newNode.type === 'text') {
    // update if different
    if (oldNode.value !== newNode.value && parentId) {
      const parentNode = (await getNodeFromDB(parentId)) as Exclude<NodeDB, TextDB>;
      deleteNode(oldNode.$loki);
      const addedNode = await addNode(newNode, parentId);
      const oldIndex = parentNode.childIds.findIndex((idx) => idx === oldNode.$loki);
      if (oldIndex === -1 && addedNode !== null) {
        parentNode.childIds.push(addedNode.$loki);
      }
      if (addedNode) parentNode.childIds[oldIndex] = addedNode.$loki;
      await updateNode(parentNode);
    }
  } else if (oldNode?.type !== 'text' && newNode.type !== 'text') {
    // both are not text
    const newhashStrings = newNode.children.map(toString);
    const oldhashStrings = oldNode.children.map((child: FullNode) => toString(child as Node));
    const { additions, deletions } = diffChildren(newhashStrings, oldhashStrings);
    deletions.forEach(async (index: number) => deleteNode(oldNode.children[index].$loki));
    const children = await runSerialReduce(
      newNode.children.map((child: Node, index: number) => async (childrenCollect: NodeDB[]) => {
        // if (ignoreQueryResult(child)) {
        //   return childrenCollect; // if query result encountered with query, delete them
        // }
        if (additions.includes(index)) {
          const addedNode = await addNode(newNode.children[index], oldNode.$loki);
          if (addedNode !== null) childrenCollect.push(addedNode);
        } else {
          if (newhashStrings[index] === oldhashStrings[index]) {
            // this happens when the query is paragraph, we need to stop checking for next few items. very very tricky IMHO
            if ((child.type === 'listItem' || child.type === 'paragraph') && isQuery(child, newNode)) {
              // handle query the awesomeness happens here
              console.log('query', child);
              // handle paragraph
              // handle list item
            }
            await diffTree(oldNode.children[index], oldNode.$loki, child, { addNode, updateNode, deleteNode });
            childrenCollect.push(oldNode.children[index]);
          } else {
            const indexInOld = oldhashStrings.findIndex((hash) => hash === newhashStrings[index]);
            if (indexInOld !== -1) {
              // found an exact match, probably due to reshuffle
              if ((child.type === 'listItem' || child.type === 'paragraph') && isQuery(child, newNode)) {
                // handle query the awesomeness happens here
                console.log('query', child);
                // handle paragraph
                // handle list item
              }
              await diffTree(oldNode.children[indexInOld], oldNode.$loki, child, { addNode, updateNode, deleteNode });
              childrenCollect.push(oldNode.children[indexInOld]);
            } else {
              if ((child.type === 'listItem' || child.type === 'paragraph') && isQuery(child, newNode)) {
                // handle query the awesomeness happens here
                console.log('query', child);
                // handle paragraph
                // handle list item
                if (child.type === 'listItem') {
                  const queryId = (oldNode.children[index] as ListItemDB).queryId;
                  if (queryId) {
                    const searchResults = (await getQueryFromDB(queryId))?.results;
                    if (searchResults) {
                      // just update them , they will be ignored when their chance comes
                      const res = child.children.slice(1, searchResults.length + 1);
                      res.forEach((searchResult, idx) => {
                        diffTree(
                          oldNode.children[index].children[idx + 1],
                          oldNode.children[index].$loki,
                          searchResult,
                          {
                            addNode,
                            updateNode,
                            deleteNode,
                          },
                        );
                      });
                    }
                  }
                }
              }
              await diffTree(oldNode.children[index], oldNode.$loki, child, { addNode, updateNode, deleteNode });
              childrenCollect.push(oldNode.children[index]);
            }
          }
        }
        return childrenCollect;
      }),
      [],
    );
    // oldNode.childIds =
    if (additions.length > 0 || deletions.length > 0) {
      oldNode.childIds = children.filter((n): n is NodeDB => !!n).map((c: NodeDB) => c.$loki);
      await updateNode(oldNode);
    }
    //proceed to check children when its not addition
  }
}
