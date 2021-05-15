export type ID = number;
// export interface Position {
//   start: { line: number; column: number; offset: number };
//   end: { line: number; column: number; offset: number };
// }
// export interface BaseNode {
//   tags?: ID[];
//   queries?: ID;
//   position: Position;
//   children?: ID[];
// }
// export interface File extends BaseNode {
//   type: 'root';
//   filePath: string;
//   children: (List & LokiObj)['$loki'][];
// }
// export interface List extends BaseNode {
//   type: 'list';
//   ordered?: boolean;
//   start?: null | number;
//   spread?: boolean;
//   children: (ListItem & LokiObj)['$loki'][];
// }
// export interface ListItem extends BaseNode {
//   type: 'listItem';
//   spread?: boolean;
//   children: (Paragraph & LokiObj)['$loki'][];
// }
// export interface Paragraph extends BaseNode {
//   type: 'paragraph';
//   children: (Text & LokiObj)['$loki'][];
// }
// export interface Text extends BaseNode {
//   type: 'text';
//   value: string;
//   tags: ID[];
// }

// export interface Heading extends BaseNode {
//   depth: number;
//   type: 'heading';
//   children: ID[];
// }

export type DBData = {
  $loki: ID;
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
export type ParagraphDB = { type: 'paragraph'; childIds: ID[] } & DBData;
export interface List {
  type: 'list';
  children: ListItem[];
}
export type ListDB = { type: 'list'; childIds: ID[] } & DBData;
export interface ListItem {
  type: 'listItem';
  children: (Paragraph | List)[];
  checked: boolean;
  ordered: boolean;
}
export type ListItemDB = { type: 'listItem'; checked: boolean; ordered: boolean; childIds: ID[] } & DBData;
export interface Heading {
  type: 'heading';
  children: Text[];
  depth: number;
}
export type RootDB = { type: 'root'; filePath: string; childIds: ID[] } & DBData;
export type HeadingDB = { type: 'heading'; childIds: ID[]; depth: number } & DBData;
export type Node = List | ListItem | Heading | Paragraph | Text;
export type NodeDB = ListDB | ListItemDB | HeadingDB | ParagraphDB | TextDB | RootDB;
export type FullNode = NodeDB & { children: FullNode[] };
export type ElementNode = File | List | ListItem | Paragraph | Text | Heading;
export type ElementNodeDoc = ElementNode & { $loki: ID };

export interface Tag {
  name: string;
  filePath: string;
  references: ID[];
  queries: ID[];
}

export interface Query {
  filePath: string;
  include: string[];
  exclude: string[];
  results: ID[];
  node: ID;
}

// export enum NodeType {
//   text = 'text',
//   paragraph = 'paragraph',
//   header = 'header',
//   listItem = 'listItem',
//   list = 'list',
//   // generic = 'generic',
// }
export type AllElements = {
  list: List;
  listItem: ListItem;
  text: Text;
  paragraph: Paragraph;
  heading: Heading;
};
export type NodeType = 'list' | 'listItem' | 'paragraph' | 'text' | 'heading';

export function setType(node: Required<{ type: 'list' }>): List;
export function setType(node: Required<{ type: 'listItem' }>): ListItem;
export function setType(node: Required<{ type: 'paragraph' }>): Paragraph;
export function setType(node: Required<{ type: 'text' }>): Text;
export function setType(node: Required<{ type: 'heading' }>): Heading;
export function setType(node: Required<{ type: NodeType }>): Node | Tree {
  switch (node.type) {
    case 'list':
      return node as List;
    case 'listItem':
      return node as ListItem;
    case 'paragraph':
      return node as Paragraph;
    case 'text':
      return node as Text;
    case 'heading':
      return node as Heading;
    default:
      return node as Tree;
  }
}

export function isLeaf(node: Leaf | Branch): node is Leaf {
  if (!node) {
    return true;
  }
  return (node as Leaf).value !== undefined && (node as Branch).children === undefined;
}
