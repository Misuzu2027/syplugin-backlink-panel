
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
    dynamicAnchor: string;
    staticAnchor: string;
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
    | "documentAlphabeticAsc"
    | "documentAlphabeticDesc"
    ;


interface IBacklinkCacheData {
    backlinks: IBacklinkData[];
    usedCache: boolean;
}


type IItemPropertyType =
    "select" |
    "text" |
    "number" |
    "button" |
    "textarea" |
    "switch" |
    "order" |
    "tips";