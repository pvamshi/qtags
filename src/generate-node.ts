import { NodeDB, Node, ID, Text, Link, ListItem, Heading, Paragraph, List } from './types';

export function generateAddNode(
  node: Node,
):
  | Text
  | Omit<Link, 'children'>
  | Omit<ListItem, 'children'>
  | Omit<Heading, 'children'>
  | Omit<Paragraph, 'children'>
  | Omit<List, 'children'> {
  switch (node.type) {
    case 'text':
      return { type: 'text', value: node.value } as Text;

    case 'link':
      return { type: node.type, title: node.title, url: node.url };

    case 'listItem':
      return {
        type: 'listItem',
        ordered: node.ordered,
        checked: node.checked,
      };
    case 'heading':
      return {
        type: 'heading',
        depth: node.depth,
      };
  }
  return { type: node.type };
}
export function generateUpdateNode(node: NodeDB): NodeDB {
  switch (node.type) {
    case 'text':
      return { type: 'text', value: node.value, $loki: node.$loki, meta: node.meta };

    case 'link':
      return {
        type: node.type,
        title: node.title,
        childIds: node.childIds,
        url: node.url,
        $loki: node.$loki,
        meta: node.meta,
      };

    case 'listItem':
      return {
        type: 'listItem',
        childIds: node.childIds,
        ordered: node.ordered,
        checked: node.checked,
        $loki: node.$loki,
        meta: node.meta,
      };
    case 'root':
      return {
        type: 'root',
        childIds: node.childIds,
        filePath: node.filePath,
        $loki: node.$loki,
        meta: node.meta,
      };
    case 'heading':
      return {
        type: node.type,
        childIds: node.childIds,
        $loki: node.$loki,
        meta: node.meta,
        depth: node.depth,
      };
  }
  node;
  return { type: node.type, childIds: node.childIds, $loki: node.$loki, meta: node.meta };
}
