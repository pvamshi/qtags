import { getNodeFromDB } from './db';
import { FullNode, ID, isLeaf, Node, NodeDB, TextDB } from './types';

// cyrb53
function toHash(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0) + '';
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
    addNode: (node: Node, parentId: ID | undefined) => Promise<NodeDB>;
    updateNode: (node: NodeDB) => Promise<NodeDB>;
    deleteNode: (nodeId: ID) => void;
  },
) {
  if (!oldNode) {
    await addNode(newNode, parentId);
  } else if (oldNode !== undefined && oldNode.type !== newNode.type) {
    await addNode(newNode, parentId);
    await deleteNode(oldNode.$loki);
  } else if (oldNode.type === 'text' && newNode.type === 'text') {
    // update if different
    if (oldNode.value !== newNode.value && parentId) {
      const parentNode = (await getNodeFromDB(parentId)) as Exclude<NodeDB, TextDB>;
      await deleteNode(oldNode.$loki);
      const addedNode = await addNode(newNode, parentId);
      const oldIndex = parentNode.childIds.findIndex((idx) => idx === oldNode.$loki);
      if (oldIndex === -1) {
        parentNode.childIds.push(addedNode.$loki);
      }
      parentNode.childIds[oldIndex] = addedNode.$loki;
      await updateNode(parentNode);
    }
  } else if (oldNode?.type !== 'text' && newNode.type !== 'text') {
    // both are not text
    const newhashStrings = newNode.children.map(toString);
    const oldhashStrings = oldNode.children.map((child: FullNode) => toString(child as Node));
    const { additions, deletions } = diffChildren(newhashStrings, oldhashStrings);
    deletions.forEach(async (index: number) => deleteNode(oldNode.children[index].$loki));
    const children = await Promise.all(
      newNode.children.map(async (child: Node, index: number) => {
        if (additions.includes(index)) {
          return await addNode(newNode.children[index], oldNode.$loki);
        } else if (newhashStrings[index] === oldhashStrings[index]) {
          await diffTree(oldNode.children[index], oldNode.$loki, child, { addNode, updateNode, deleteNode });
          return oldNode.children[index];
        } else {
          const indexInOld = oldhashStrings.findIndex((hash) => hash === newhashStrings[index]);
          if (indexInOld !== -1) {
            await diffTree(oldNode.children[indexInOld], oldNode.$loki, child, { addNode, updateNode, deleteNode });
            return oldNode.children[indexInOld];
          } else {
            await diffTree(oldNode.children[index], oldNode.$loki, child, { addNode, updateNode, deleteNode });
            return oldNode.children[index];
          }
        }
      }),
    );
    // oldNode.childIds =
    if (additions.length > 0 || deletions.length > 0) {
      oldNode.childIds = children.filter((n): n is NodeDB => !!n).map((c: NodeDB) => c.$loki);
      await updateNode(oldNode);
    }
    //proceed to check children when its not addition
  }
}
