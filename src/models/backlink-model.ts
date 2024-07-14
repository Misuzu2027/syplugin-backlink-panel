
export interface DefBlockQueryCriteria {
    rootId: string;
    focusBlockId?: string;
    queryParentDefBlock?: boolean;
    querrChildDefBlockForListItem?: boolean;
    queryChildDefBlockForHeadline?: boolean;
    defBlockIds?: string[];
    backlinkParentBlockIds?: string[];
}


export interface RelatedBlockQueryCriteria {
    defBlockIds: string[];
    backlinkParentBlockIds?: string[];
    // includeTypes: string[];
    // relatedDefBlockIdArray?: string[];
}


export interface BacklinkBlockNode {
    block: DefBlock;
    concatContent: string;
    includeDirectDefBlockIds: Set<string>;
    includeRelatedDefBlockIds: Set<string>;
}


export interface BacklinkPanelData {
    rootId: string;
    backlinkBlockNodeArray: BacklinkBlockNode[];
    // 当前文档的定义块
    curDocDefBlockArray: DefBlock[];
    // 有关联的定义块
    relatedDefBlockArray: DefBlock[];
    // 关联块所属的文档
    relatedDocumentArray: DefBlock[];

    // 关联块文档数据结构，不采用文档方式
    // documentNodeArray: DocumentNode[];
}

export interface BacklinkPanelRenderQueryCondition {
    keywordStr: string;
    pageNum: number;
    pageSize: number;
    backlinkBlockSortMethod: BlockSortMethod;
    includeRelatedDefBlockIds: Set<string>;
    excludeRelatedDefBlockIds: Set<string>;
    includeDocumentIds: Set<string>;
    excludeDocumentIds: Set<string>;

}

export interface BacklinkPanelQueryCondition extends BacklinkPanelRenderQueryCondition {
    filterPanelCurDocDefBlockSortMethod: BlockSortMethod;
    filterPanelCurDocDefBlockKeywords: string;

    filterPanelRelatedDefBlockSortMethod: BlockSortMethod;
    filterPanelRelatedDefBlockKeywords: string;

    filterPanelRelatedDocumentSortMethod: BlockSortMethod;
    filterPanelRelatedDocumentKeywords: string;
}



export interface BacklinkPanelRenderData {
    rootId: string;

    backlinkDocArray: IBacklinkData[];

    backlinkBlockNodeArray: BacklinkBlockNode[];
    // 当前文档的定义块
    curDocDefBlockArray: DefBlock[];
    // 有关联的定义块
    relatedDefBlockArray: DefBlock[];
    // 关联块所属的文档
    relatedDocumentArray: DefBlock[];

    pageNum: number;
    pageSize: number;
    totalPage: number;
    usedCache: boolean;
}