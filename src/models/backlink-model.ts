
export interface IBacklinkPanelDataQueryParams {
    rootId: string;
    focusBlockId?: string;
    queryParentDefBlock?: boolean;
    querrChildDefBlockForListItem?: boolean;
    queryChildDefBlockForHeadline?: boolean;
    defBlockIds?: string[];
    backlinkParentBlockIds?: string[];
}


export interface IBacklinkBlockQueryParams {
    defBlockIds: string[];
    backlinkParentBlockIds?: string[];
    // includeTypes: string[];
    // relatedDefBlockIdArray?: string[];
}


export interface IBacklinkBlockNode {
    block: DefBlock;
    concatContent: string;
    includeDirectDefBlockIds: Set<string>;
    includeRelatedDefBlockIds: Set<string>;
}


export interface IBacklinkPanelData {
    rootId: string;
    backlinkBlockNodeArray: IBacklinkBlockNode[];
    // 当前文档的定义块
    curDocDefBlockArray: DefBlock[];
    // 有关联的定义块
    relatedDefBlockArray: DefBlock[];
    // 关联块所属的文档
    relatedDocumentArray: DefBlock[];

    userCache?: boolean;

    // 关联块文档数据结构，不采用文档方式
    // documentNodeArray: DocumentNode[];
}

export interface IBacklinkPanelRenderQueryParams {
    keywordStr: string;
    pageNum: number;
    pageSize: number;
    backlinkBlockSortMethod: BlockSortMethod;
    includeRelatedDefBlockIds: Set<string>;
    excludeRelatedDefBlockIds: Set<string>;
    includeDocumentIds: Set<string>;
    excludeDocumentIds: Set<string>;

}

export interface IBacklinkPanelRednerFilterQueryParams extends IBacklinkPanelRenderQueryParams {
    filterPanelCurDocDefBlockSortMethod: BlockSortMethod;
    filterPanelCurDocDefBlockKeywords: string;

    filterPanelRelatedDefBlockSortMethod: BlockSortMethod;
    filterPanelRelatedDefBlockKeywords: string;

    filterPanelRelatedDocumentSortMethod: BlockSortMethod;
    filterPanelRelatedDocumentKeywords: string;
}



export interface IBacklinkPanelRenderData {
    rootId: string;

    backlinkDocArray: IBacklinkData[];

    backlinkBlockNodeArray: IBacklinkBlockNode[];
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

export class BacklinkPanelFilterCriteria {
    // backlinkPanelBaseDataQueryParams: BacklinkPanelBaseDataQueryParams;
    queryParams: IBacklinkPanelRednerFilterQueryParams;
    backlinkPanelFilterViewExpand: boolean;

}