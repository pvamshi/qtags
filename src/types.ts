export type ID = number;
export type DBData = {
  $loki: ID;
  parentId: ID;
  meta: any;
};
export interface Leaf {
  value: string;
}
export interface Branch {
  children: Tree[];
}
export type Tree = (Leaf | Branch) & { type: string };
export interface Text {
  type: 'text';
  value: string;
}
export type TextDB = Text & DBData;
export interface Paragraph {
  type: 'paragraph';
  children: Text[];
}
export type ParagraphDB = { type: 'paragraph'; childIds: ID[]; queryId?: ID; tags?: string[] } & DBData;
export interface List {
  type: 'list';
  spread?: boolean;
  children: ListItem[];
}
export type ListDB = { type: 'list'; spread?: boolean; childIds: ID[] } & DBData;
export interface ListItem {
  type: 'listItem';
  children: (Paragraph | List)[];
  spread?: boolean;
  checked: boolean | null;
  ordered: boolean;
}
export type ListItemDB = {
  type: 'listItem';
  checked: boolean;
  spread?: boolean;
  ordered: boolean;
  childIds: ID[];
  tags?: string[];
  queryId?: ID;
} & DBData;

export type Link = {
  type: 'link';
  url: string;
  title: string;
  children: Text[];
};
export type LinkDB = Omit<Link, 'children'> & { childIds: ID[] } & DBData;
export interface Heading {
  type: 'heading';
  children: Text[];
  depth: number;
}
export type Root = { type: 'root'; filePath: string; children: Node[] };
export type RootDB = { type: 'root'; filePath: string; childIds: ID[] } & Omit<DBData, 'parentId'>;
export type HeadingDB = { type: 'heading'; childIds: ID[]; depth: number } & DBData;
export type Node = List | ListItem | Heading | Paragraph | Text | Link | Root;
export type NodeDB = ListDB | ListItemDB | HeadingDB | ParagraphDB | TextDB | RootDB | LinkDB;
export type FullNode = NodeDB & { children: FullNode[] };
export type ElementNode = File | List | ListItem | Paragraph | Text | Heading;
export type ElementNodeDoc = ElementNode & { $loki: ID };

export interface Tag {
  name: string;
  references: ID[];
  queries: ID[];
}

export type TagDB = Tag & LokiObj;
export interface Query {
  include: string[];
  exclude: string[];
  results: ID[] | null;
  node: ID;
}
export type QueryTags = Pick<Query, 'include' | 'exclude'>;
export type QueryDB = Query & LokiObj;

// export enum NodeType {
//   text = 'text',
//   paragraph = 'paragraph',
//   header = 'header',
//   listItem = 'listItem',
//   list = 'list',
//   // generic = 'generic',
// }
// export type AllElements = {
//   list: List;
//   listItem: ListItem;
//   text: Text;
//   paragraph: Paragraph;
//   heading: Heading;
// };
// export type NodeType = 'list' | 'listItem' | 'paragraph' | 'text' | 'heading';

// export function setType(node: Required<{ type: 'list' }>): List;
// export function setType(node: Required<{ type: 'listItem' }>): ListItem;
// export function setType(node: Required<{ type: 'paragraph' }>): Paragraph;
// export function setType(node: Required<{ type: 'text' }>): Text;
// export function setType(node: Required<{ type: 'heading' }>): Heading;
// export function setType(node: Required<{ type: NodeType }>): Node | Tree {
//   switch (node.type) {
//     case 'list':
//       return node as List;
//     case 'listItem':
//       return node as ListItem;
//     case 'paragraph':
//       return node as Paragraph;
//     case 'text':
//       return node as Text;
//     case 'heading':
//       return node as Heading;
//     default:
//       return node as Tree;
//   }
// }

export function isLeaf(node: Leaf | Branch): node is Leaf {
  if (!node) {
    return true;
  }
  return (node as Branch).children === undefined;
}
