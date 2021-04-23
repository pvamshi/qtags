export type ID = number;
export interface Position {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
export interface BaseNode {
  position: Position;
  children?: ID[];
}
export interface File extends BaseNode {
  type: 'root';
  filePath: string;
  children: (List & LokiObj)['$loki'][];
}
export interface List extends BaseNode {
  type: 'list';
  ordered?: boolean;
  start?: null | number;
  spread?: boolean;
  children: (ListItem & LokiObj)['$loki'][];
}
export interface ListItem extends BaseNode {
  type: 'listItem';
  spread?: boolean;
  children: (Paragraph & LokiObj)['$loki'][];
}
export interface Paragraph extends BaseNode {
  type: 'paragraph';
  children: (Text & LokiObj)['$loki'][];
}
export interface Text extends BaseNode {
  type: 'text';
  value: string;
  tags: ID[];
}

export interface Heading extends BaseNode {
  depth: number;
  type: 'heading';
  children: ID[];
}
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
  includeTags: string[];
  excludeTags: string[];
  results: ID[];
  node: ID;
}
