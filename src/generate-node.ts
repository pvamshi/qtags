import { Heading, Link, List, ListItem, Node, NodeDB, Paragraph, Root, Text } from './types';

export function generateAddNode(
  node: Node,
):
  | Text
  | Omit<Root, 'children'>
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
        spread: node.spread,
        tags: node.tags,
        queryId: node.queryId,
      };
    case 'heading':
      return {
        type: 'heading',
        depth: node.depth,
      };
    case 'list':
      return {
        type: 'list',
        spread: node.spread,
      };
    case 'root':
      return {
        type: 'root',
        filePath: node.filePath,
      };
  }
  return { type: node.type };
}
export function generateUpdateNode(node: NodeDB): NodeDB {
  switch (node.type) {
    case 'text':
      return { type: 'text', value: node.value, $loki: node.$loki, meta: node.meta, parentId: node.parentId };

    case 'link':
      return {
        type: node.type,
        title: node.title,
        childIds: node.childIds,
        url: node.url,
        $loki: node.$loki,
        meta: node.meta,
        parentId: node.parentId,
      };

    case 'listItem':
      return {
        type: 'listItem',
        spread: node.spread,
        childIds: node.childIds,
        ordered: node.ordered,
        checked: node.checked,
        $loki: node.$loki,
        meta: node.meta,
        parentId: node.parentId,
        queryId: node.queryId,
        tags: node.tags,
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
        parentId: node.parentId,
      };
    case 'paragraph':
      return {
        type: node.type,
        childIds: node.childIds,
        $loki: node.$loki,
        meta: node.meta,
        parentId: node.parentId,
        queryId: node.queryId,
        tags: node.tags,
      };
    default:
      return {
        type: node.type,
        childIds: node.childIds,
        $loki: node.$loki,
        meta: node.meta,
        parentId: node.parentId,
        spread: node.spread,
      };
  }
}
