/// <reference types="lokijs" />
import { ID } from './types';
export declare class Tag {
    name: string;
    filePath: string;
    nodeId: ID;
    collection: Collection<Tag>;
    $loki: ID | undefined;
    references: ID[];
    queries: ID[];
    constructor(name: string, filePath: string, nodeId: ID, collection: Collection<Tag>);
    save(): void;
}
