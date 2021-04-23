import { DB } from './db';
declare function plugin({ filePath, db }: {
    filePath: string;
    db: DB;
}): (tree: any) => void;
export default plugin;
