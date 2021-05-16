import { addQueryToDB, getQueryForNode, updateNodeToDB, updateQueryInDB } from './db';
import { ListItemDB, ParagraphDB, QueryDB, QueryTags } from './types';

export async function addQuery(query: QueryTags, node: ParagraphDB | ListItemDB): Promise<QueryDB> {
  const existingQuery = await getQueryForNode(node.$loki);
  if (existingQuery) {
    return updateQueryInDB({
      $loki: existingQuery.$loki,
      ...query,
      results: [],
      node: node.$loki,
      meta: existingQuery.meta,
    });
  }
  const queryAdded = await addQueryToDB({ ...query, results: [], node: node.$loki });
  node.queryId = queryAdded.$loki;
  await updateNodeToDB(node);
  return queryAdded;
}
