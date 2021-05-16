import { addTagToDB, getTagFromDB, updateTag } from './db';
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
