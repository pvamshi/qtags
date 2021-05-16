import { getNodeFromDB } from './db';
import { addTag, deleteTagsForNode } from './tags';
import { ID, ListItemDB, Node, NodeDB, ParagraphDB, TextDB } from './types';
type methods = 'preAdd' | 'postAdd';
export interface Plugin {
  name: string;
  preAdd?: (node: Node) => void;
  postAdd?: (node: NodeDB) => void;
  preUpdate?: (node: NodeDB) => Node;
  postUpdate?: (node: NodeDB) => void;
  preDelete?: (node: NodeDB) => void;
  generateTags?: (text: string) => string[];
  transformTags?: (tags: string[]) => string[];
}

export const plugins: Plugin[] = [
  {
    name: 'add-tags',
    postAdd: addTags,
    postUpdate: addTags,
  },
  {
    name: 'basic-tags',
    generateTags: basicTags,
    transformTags: (tags) => tags,
  },
  { name: 'cleanup', preDelete: cleanUpTagsBeforeDelete },
];

export function isDefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}
// type Parameters<T> = T extends (...args: infer T) => any ? T : never;
// type ReturnType<T> = T extends (... args: any[]) => infer T ? T : never;

export function runPlugin<T extends keyof Plugin>(fn: T): Plugin[T][] {
  return plugins.map((p) => p[fn]).filter(isDefined);
}

async function cleanUpTagsBeforeDelete(node: NodeDB) {
  if (node.type === 'text') {
    const parent = await getParent(node);
    if (parent && parent.type === 'paragraph') {
      const grandParent = await getParent(parent);
      deleteTagsForNode(grandParent && grandParent.type === 'listItem' ? grandParent : parent);
    }
  }
}

async function addTags(node: NodeDB) {
  if (node.type === 'text') {
    const parent = await getParent(node);
    if (parent && parent.type === 'paragraph') {
      const grandParent = await getParent(parent);
      const text = node.value;
      const tags = plugins
        .map((p) => p['generateTags'])
        .filter(isDefined)
        .flatMap((f) => f(text));
      return Promise.all(
        tags.map((t) => addTag(t, grandParent && grandParent.type === 'listItem' ? grandParent : parent)),
      );
    }
  }
}
async function getParent(node: NodeDB) {
  if (node.type === 'root' || !node.parentId) {
    return null;
  }
  return getNodeFromDB(node.parentId);
}
async function addTagsForParagraph(node: NodeDB) {
  if (node.type === 'paragraph') {
    const parentNode = await getNodeFromDB(node.parentId);
    if (parentNode.type === 'listItem') {
      return;
    }
    const text = await getTextForParagraph(node);
    const tags = plugins
      .map((p) => p['generateTags'])
      .filter(isDefined)
      .flatMap((f) => f(text));
    return Promise.all(tags.map((t) => addTag(t, node)));
  }
}
function basicTags(text: string): string[] {
  const hashTagRegexp = /(\s|^)#([a-zA-Z0-9-_.]+)/g;
  const hashTagMatches = text.matchAll(hashTagRegexp);
  const tags: string[] = [];
  for (const match of hashTagMatches) {
    const tag = match[2];
    tags.push(tag);
  }
  return plugins
    .map((p) => p['transformTags'])
    .filter(isDefined)
    .flatMap((f) => f(tags));
}
async function getTextForList(listItem: ListItemDB): Promise<string> {
  if (listItem.childIds.length === 0) return '';
  const paragraph = (await getNodeFromDB(listItem.childIds[0])) as ParagraphDB;
  return getTextForParagraph(paragraph);
}
async function getTextForParagraph(paragraph: ParagraphDB): Promise<string> {
  if (!paragraph || paragraph.childIds.length === 0) return '';
  const texts = (await Promise.all(paragraph.childIds.map((c: ID) => getNodeFromDB(c)))) as TextDB[];
  return texts.map((t) => t.value).join('');
}

function getMetadata(text: string) {
  const queryResponseRegexp = /𖥔|·$/;
  const hashTagRegexp = /(\s|^)#([a-zA-Z0-9-_.]+)/g;
  const queryRegexp = /(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g;
  if (text.match(queryResponseRegexp)) {
    // query
  }
  const hashTagMatches = text.matchAll(hashTagRegexp);
  const tags = [];
  for (const match of hashTagMatches) {
    const tag = match[2];
    tags.push(tag);
  }
}
async function getNodeMeta(node: NodeDB) {
  const queryResponseRegexp = /𖥔|·$/;
  const hashTagRegexp = /(\s|^)#([a-zA-Z0-9-_.]+)/g;
  const queryRegexp = /(\s|^)(\+|-)([a-zA-Z0-9-_.]+)/g;

  const text = nodes.map((n: any) => n.value).join('');
  if (text.match(queryResponseRegexp)) {
    return { ignore: true };
  }

  const hashTagMatches = text.matchAll(hashTagRegexp);
  const tags = [];
  for (const match of hashTagMatches) {
    const tag = match[2];
    tags.push(tag);
  }
  if (tags.length > 0) {
    return { tags: plugins.filter((p) => p.parse).reduce((tags, { parse }) => parse(tags), tags) };
  }

  const queryTagMatches = text.matchAll(queryRegexp);
  const queryTags: { include: string[]; exclude: string[] } = { include: [], exclude: [] };

  for (const match of queryTagMatches) {
    if (match[2] === '+') {
      queryTags.include.push(match[3]);
    } else {
      queryTags.exclude.push(match[3]);
    }
  }
  if (queryTags.include.length > 0 || queryTags.exclude.length > 0) {
    return { query: queryTags };
  }
}
