import { FullNode, isLeaf, Node, NodeDB } from './types';

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
  switch (node.type) {
    case 'listItem':
      return toHash(JSON.stringify({ checked: node.checked, children: node.children.map(toString) }));

    case 'text':
      return node.value;

    case 'heading':
      return toHash(JSON.stringify({ depth: node.depth, children: node.children.map(toString) }));

    case 'paragraph':
    case 'list':
    default:
      console.log({ node });
      return isLeaf(node) ? node.value : toHash(node.children.map(toString).join(''));
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
export function diffTree(
  oldNode: FullNode | undefined,
  newNode: Node,
  {
    addNode,
    deleteNode,
    updateNode,
  }: {
    addNode: (node: Node, addChildren?: boolean) => NodeDB;
    updateNode: (node: NodeDB) => NodeDB;
    deleteNode: (node: NodeDB, deleteChildren?: boolean) => void;
  },
) {
  if (!oldNode) {
    addNode(newNode, true);
  } else if (oldNode !== undefined && oldNode.type !== newNode.type) {
    addNode(newNode, true);
    deleteNode(oldNode, true);
  } else if (oldNode.type === 'text' && newNode.type === 'text') {
    // update if different
    if (oldNode.value !== newNode.value) {
      oldNode.value = newNode.value;
      updateNode(oldNode);
    }
  } else if (oldNode?.type !== 'text' && newNode.type !== 'text') {
    // both are not text
    const newhashStrings = newNode.children.map(toString);
    const oldhashStrings = oldNode.children.map((child: FullNode) => toString(child as Node));
    const { additions, deletions } = diffChildren(newhashStrings, oldhashStrings);
    deletions.forEach((index: number) => deleteNode(oldNode.children[index], true));
    const children = newNode.children.map((child: Node, index: number) => {
      if (additions.includes(index)) {
        return addNode(newNode.children[index]);
      } else if (newhashStrings[index] === oldhashStrings[index]) {
        diffTree(oldNode.children[index], child, { addNode, updateNode, deleteNode });
        return oldNode.children[index];
      } else {
        const indexInOld = oldhashStrings.findIndex((hash) => hash === newhashStrings[index]);
        if (indexInOld !== -1) {
          diffTree(oldNode.children[indexInOld], child, { addNode, updateNode, deleteNode });
          return oldNode.children[indexInOld];
        } else {
          diffTree(oldNode.children[index], child, { addNode, updateNode, deleteNode });
          return oldNode.children[index];
        }
      }
    });
    // oldNode.childIds =
    if (additions.length > 0 || deletions.length > 0) {
      oldNode.childIds = children.filter((n): n is NodeDB => !!n).map((c: NodeDB) => c.$loki);
      updateNode(oldNode);
    }
    //proceed to check children when its not addition
  }
}