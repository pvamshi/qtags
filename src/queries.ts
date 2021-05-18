import {
  addQueryToDB,
  getNodeFromDB,
  getQueryForNode,
  getQueryFromDB,
  getTagFromDB,
  updateNodeToDB,
  updateQueryInDB,
} from './db';
import { isDefined } from './plugins';
import { ID, ListItemDB, NodeDB, ParagraphDB, QueryDB, QueryTags } from './types';

export async function addQuery(query: QueryTags, node: ParagraphDB | ListItemDB): Promise<QueryDB | null> {
  if (query.include.length === 0) {
    return null;
  }
  const existingQuery = await getQueryForNode(node.$loki);
  if (existingQuery) {
    return updateQueryInDB({
      $loki: existingQuery.$loki,
      ...query,
      results: null,
      node: node.$loki,
      meta: existingQuery.meta,
    });
  }
  const queryAdded = await addQueryToDB({ ...query, results: null, node: node.$loki });
  node.queryId = queryAdded.$loki;
  await updateNodeToDB(node);
  return queryAdded;
}

export async function getResults(queryId: ID): Promise<ID[]> {
  const query = await getQueryFromDB(queryId);
  if (!query) return [];
  const includes = (await Promise.all(query.include.map((includeTag) => getTagFromDB(includeTag)))).filter(isDefined);
  const results = await Promise.all(
    includes.map((tag) =>
      tag.references
        ? tag.references.map(async (nodeId) => {
            const node = await getNodeFromDB(nodeId);
            return await queryNodeForTags(node, {
              include: query.include.filter((t) => t !== tag.name),
              exclude: query.exclude,
            });
          })
        : [],
    ),
  );
  console.log({ results });
  // return (
  //   await Promise.all(
  //     query.include.flatMap(async (includeTag) => {
  //       const nodeIds = (await getTagFromDB(includeTag))?.references;
  //       if (!nodeIds) return [];
  //       const nodes = await Promise.all(nodeIds.map((nodeId) => getNodeFromDB(nodeId)));
  //       return nodes.map((node) => queryNodeForTags(node, query));
  //     }),
  //   )
  // ).flat();
}

function hasMatch(node: ListItemDB | ParagraphDB, query: QueryTags): boolean {
  if (!node.tags) return false;
  return node.tags.some((tag) => query.include.includes(tag)) && !node.tags.some((tag) => query.exclude.includes(tag));
}
async function queryNodeForTags(node: NodeDB, query: QueryTags): Promise<ID[]> {
  if (query.include.length === 0 || node.type === 'text') return [];
  const childNodes = await Promise.all(node.childIds.map((childId) => getNodeFromDB(childId)));
  return (
    await Promise.all(
      childNodes.map(async (child) => {
        if ((child.type === 'paragraph' || child.type === 'listItem') && hasMatch(child, query) && child.tags) {
          query.include = query.include.filter((includeTag) => !child.tags?.includes(includeTag));
          if (query.include.length === 0) {
            return [child.$loki];
          }
          return await queryNodeForTags(child, query);
        }
        return await queryNodeForTags(child, query);
      }),
    )
  ).flat();
}
