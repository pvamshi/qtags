import { addTagToDB, deleteTag, getTagFromDB, getTagsForNode, queryForNode, updateTag } from './db';
import { NodeDB, TagDB } from './types';

export async function addTag(tagName: string, node: NodeDB): Promise<TagDB> {
  const existingTag = await getTagFromDB(tagName);
  if (existingTag) {
    if (existingTag.references.includes(node.$loki)) {
      return existingTag;
    }
    existingTag.references.push(node.$loki);
    return updateTag(existingTag);
  }
  return addTagToDB({ name: tagName, references: [node.$loki], queries: [] });
}

export async function deleteTagsForNode(node: NodeDB) {
  const tagsForNode = await getTagsForNode(node.$loki);
  return Promise.all(
    tagsForNode
      .map((tag) => ({ ...tag, references: tag.references.filter((id) => id !== node.$loki) }))
      .map((tag) => (tag.references.length === 0 ? deleteTag(tag) : updateTag(tag))),
  );
}
