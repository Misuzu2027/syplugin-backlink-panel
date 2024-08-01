
export interface IBacklinkFilterPanelDataQueryParams {
    rootId: string;
    focusBlockId?: string;
    queryParentDefBlock?: boolean;
    querrChildDefBlockForListItem?: boolean;
    queryChildDefBlockForHeadline?: boolean;
}


export interface IBacklinkBlockQueryParams {
    queryParentDefBlock?: boolean;
    querrChildDefBlockForListItem;
    queryChildDefBlockForHeadline?: boolean;
    defBlockIds: string[];
    backlinkBlockIds?: string[];
    backlinkBlocks?: BacklinkBlock[];
    backlinkParentBlockIds?: string[];
    // queryAllContentUnderHeadline?: boolean;
    // includeTypes: string[];
    // relatedDefBlockIdArray?: string[];
}


export interface IBacklinkBlockNode {
    block: DefBlock;
    documentBlock: DefBlock;
    concatContent: string;
    includeDirectDefBlockIds: Set<string>;
    includeRelatedDefBlockIds: Set<string>;
    dynamicAnchorMap: Map<string, Set<string>>;
    staticAnchorMap: Map<string, Set<string>>;
}


export interface IBacklinkFilterPanelData {
    rootId: string;
    backlinkBlockNodeArray: IBacklinkBlockNode[];
    // 当前文档的定义块
    curDocDefBlockArray: DefBlock[];
    // 有关联的定义块
    relatedDefBlockArray: DefBlock[];
    // 反链块所属的文档
    backlinkDocumentArray: DefBlock[];

    userCache?: boolean;

    // 关联块文档数据结构，不采用文档方式
    // documentNodeArray: DocumentNode[];
}

export interface IPanelRenderBacklinkQueryParams {
    pageNum: number;
    pageSize: number;
    backlinkCurDocDefBlockType: string;
    backlinkBlockSortMethod: BlockSortMethod;
    backlinkKeywordStr: string;
    includeRelatedDefBlockIds: Set<string>;
    excludeRelatedDefBlockIds: Set<string>;
    includeDocumentIds: Set<string>;
    excludeDocumentIds: Set<string>;

}

export interface IPanelRednerFilterQueryParams extends IPanelRenderBacklinkQueryParams {
    filterPanelCurDocDefBlockSortMethod: BlockSortMethod;
    filterPanelCurDocDefBlockKeywords: string;

    filterPanelRelatedDefBlockType: string;
    filterPanelRelatedDefBlockSortMethod: BlockSortMethod;
    filterPanelRelatedDefBlockKeywords: string;

    filterPanelBacklinkDocumentSortMethod: BlockSortMethod;
    filterPanelBacklinkDocumentKeywords: string;
}



export interface IBacklinkPanelRenderData {
    rootId: string;

    backlinkDataArray: IBacklinkData[];

    backlinkBlockNodeArray: IBacklinkBlockNode[];
    // 当前文档的定义块
    curDocDefBlockArray: DefBlock[];
    // 有关联的定义块
    relatedDefBlockArray: DefBlock[];
    // 反链块所属的文档块信息
    backlinkDocumentArray: DefBlock[];

    pageNum: number;
    pageSize: number;
    totalPage: number;
    usedCache: boolean;
}

export class BacklinkPanelFilterCriteria {
    // backlinkPanelBaseDataQueryParams: BacklinkPanelBaseDataQueryParams;
    queryParams: IPanelRednerFilterQueryParams;
    backlinkPanelFilterViewExpand: boolean;

}