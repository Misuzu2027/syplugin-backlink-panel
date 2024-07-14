
type BacklinkParentBlock = DefBlock & {
    childIdPath: string;
    subMarkdown: string;
};


type BacklinkChildBlock = DefBlock & {
    parentIdPath: string;
};



type BacklinkBlock = DefBlock & {
    parentBlockType: string;
    parentListItemMarkdown: string;
};


type DefBlock = Block & {
    refCount: number;
    anchor: string;
    selectionStatus: string;
    filterStatus: boolean;
};

type BlockSortMethod =
    | "type"
    | "content"
    | "typeAndContent"
    | "modifiedAsc"
    | "modifiedDesc"
    | "createdAsc"
    | "createdDesc"
    | "rankAsc"
    | "rankDesc"
    | "refCountAsc"
    | "refCountDesc"
    | "alphabeticAsc"
    | "alphabeticDesc"
    ;


interface IBacklinkCacheData {
    backlinks: IBacklinkData[];
    usedCache: boolean;
}