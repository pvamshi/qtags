import { ID } from './types';

export class Tag {
  // const addRefToTag = (name: string, filePath: string, nodeId: ID): Tag & LokiObj => {
  //   let tag: Tag & LokiObj = tags.findOne({ name, filePath }) as Tag & LokiObj;
  //   if (!tag) {
  //     tag = addTag(name, filePath, [nodeId]) as Tag & LokiObj;
  //   } else {
  //     tag.references.push(nodeId);
  //     tags.update(tag);
  //   }
  //   return tag;
  // };
  // private $loki: ID;
  $loki: ID | undefined;
  references: ID[] = [];
  queries: ID[] = [];
  constructor(public name: string, public filePath: string, public nodeId: ID, public collection: Collection<Tag>) {
    const existingTag = collection.findOne({ name, filePath });
    if (existingTag) {
      this.$loki = existingTag.$loki;
      this.references = existingTag.references;
      this.queries = existingTag.queries;
    } else {
      // collection.insertOne({ name, filePath, references: this.references, queries: this.queries }) as Tag & LokiObj;
    }
  }
  public save() {
    this.db.find;
  }
}
