import { addQueryToDB, getNodeFromDB, getQueryForNode, updateNodeToDB, updateQueryInDB } from './db';
import { ListItemDB, ParagraphDB, QueryDB, QueryTags } from './types';

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
  console.log({ node });
  await updateNodeToDB(node);
  console.log(await getNodeFromDB(node.$loki));
  return queryAdded;
}
