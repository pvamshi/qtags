/// <reference types="lokijs" />
import { ElementNode, ElementNodeDoc, File, ID, Tag } from './types';
export interface DB {
    getNode(id: ID): ElementNode;
    addNode<T>(node: T & {
        children?: ID[];
    }): T;
    deleteNode(nodeId: ID): void;
    updateNode(node: ElementNodeDoc): void;
    getFile(filePath: string): (File & LokiObj) | undefined;
    addTag(name: string, filePath: string, references?: ID[]): Tag & LokiObj;
    addRefToTag(name: string, filePath: string, nodeId: ID): Tag & LokiObj;
    unlinkFileToTag(filePath: string): void;
    tags: Collection<Tag>;
    nodes: Collection<ElementNode>;
}
export declare function getDb(): Promise<DB>;
export declare function initDB(): Promise<{
    nodes: Collection<any>;
    tags: Collection<Tag>;
}>;
