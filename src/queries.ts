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

// query should have multiple references , we should not duplicate
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
  const refs = includes.map((tagdb) => ({ name: tagdb.name, refs: tagdb.references })).filter((obj) => obj.refs);
  return (
    await Promise.all(
      refs.flatMap(async (ref) => {
        const nodes = await Promise.all(ref.refs.map((r) => getNodeFromDB(r)));
        return (
          await Promise.all(
            nodes.flatMap((node) =>
              queryNodeForTags(node, { include: query.include.filter((t) => t !== ref.name), exclude: query.exclude }),
            ),
          )
        ).flat();
      }),
    )
  ).flat();
}

function hasMatch(node: ListItemDB | ParagraphDB, query: QueryTags): boolean {
  if (!node.tags) return false;
  return node.tags.some((tag) => query.include.includes(tag)) && !node.tags.some((tag) => query.exclude.includes(tag));
}
async function queryNodeForTags(node: NodeDB, query: QueryTags): Promise<ID[]> {
  if (query.include.length === 0) return [node.$loki];
  if (node.type === 'text') return [];
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
