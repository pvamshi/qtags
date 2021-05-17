import { addTagToDB, deleteTag, getTagFromDB, getTagsForNode, updateNodeToDB, updateTag } from './db';
import { ListItemDB, ParagraphDB, TagDB } from './types';

export async function addTag(tagName: string, node: ParagraphDB | ListItemDB): Promise<TagDB> {
  const existingTag = await getTagFromDB(tagName);
  if (existingTag) {
    if (existingTag.references.includes(node.$loki)) {
      return existingTag;
    }
    existingTag.references.push(node.$loki);
    node.tags = (node.tags || []).concat(tagName);
    await updateNodeToDB(node);
    return updateTag(existingTag);
  }

  node.tags = (node.tags || []).concat(tagName);
  await updateNodeToDB(node);
  return addTagToDB({ name: tagName, references: [node.$loki], queries: [] });
}

export async function deleteTagsForNode(node: ParagraphDB | ListItemDB) {
  const tagsForNode = await getTagsForNode(node.$loki);
  node.tags = undefined;
  await updateNodeToDB(node);
  return Promise.all(
    tagsForNode
      .map((tag) => ({ ...tag, references: tag.references.filter((id) => id !== node.$loki) }))
      .map((tag) => (tag.references.length === 0 ? deleteTag(tag) : updateTag(tag))),
  );
}
