import { ListItemDB, Node, NodeDB } from './types';
type methods = 'preAdd' | 'postAdd';
export interface Plugin {
  name: string;
  preAdd?: (node: Node) => Node;
  postAdd?: (node: NodeDB) => Node;
}
export const plugins: Plugin[] = [
  {
    name: 'list-tags',
    postAdd: (node: NodeDB) => {
      if (node.type === 'listItem') {
      }
    },
  },
];

export function isDefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}
type Parameters<T> = T extends (...args: infer T) => any ? T : never;
// type ReturnType<T> = T extends (... args: any[]) => infer T ? T : never;

export function runPlugin<T extends keyof Plugin>(fn: T): Plugin[T][] {
  return plugins.map((p) => p[fn]).filter(isDefined);
}

function getText(listItem: ListItemDB) {}
