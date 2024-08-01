import { sql, getBatchBlockIdIndex, getBacklinkDoc } from "@/utils/api";
import { generateGetParentDefBlockArraySql, generateGetBacklinkListItemBlockArraySql, generateGetDefBlockArraySql as generateGetDocDefBlockArraySql, generateGetBlockArraySql, generateGetParenListItemtDefBlockArraySql, generateGetChildDefBlockArraySql, generateGetBacklinkBlockArraySql } from "./backlink-sql";
import { IBacklinkFilterPanelData, IBacklinkBlockQueryParams, IBacklinkBlockNode, IBacklinkFilterPanelDataQueryParams, IPanelRenderBacklinkQueryParams, IBacklinkPanelRenderData } from "@/models/backlink-model";
import { getObjectSizeInKB } from "@/utils/object-util";
import { containsAllKeywords, countOccurrences, isValidStr, longestCommonSubstring, splitKeywordStringToArray } from "@/utils/string-util";
import { getLastItem, isArrayEmpty, isSetNotEmpty, paginate } from "@/utils/array-util";
import { DefinitionBlockStatus } from "@/models/backlink-constant";
import { CacheManager } from "@/config/CacheManager";
import { SettingService } from "./setting/SettingService";





export async function getBacklinkPanelRenderData(
    backlinkPanelData: IBacklinkFilterPanelData,
    queryParams: IPanelRenderBacklinkQueryParams,
): Promise<IBacklinkPanelRenderData> {
    const startTime = performance.now(); // 记录开始时间

    if (!backlinkPanelData || !queryParams) {
        return
    }
    let pageNum = 1;
    let pageSize = SettingService.ins.SettingConfig.pageSize;
    let rootId = backlinkPanelData.rootId;

    cleanInvalidQueryParams(queryParams, backlinkPanelData);

    let backlinkBlockNodeArray = backlinkPanelData.backlinkBlockNodeArray;
    let validBacklinkBlockNodeArray: IBacklinkBlockNode[] = [];
    for (const backlinkBlockNode of backlinkBlockNodeArray) {
        let valid = isBacklinkBlockValid(queryParams, backlinkBlockNode);
        if (!valid) {
            continue;
        }
        validBacklinkBlockNodeArray.push(backlinkBlockNode);
    }
    let totalPage = calculateTotalPages(validBacklinkBlockNodeArray.length, pageSize);
    // if (pageNum > totalPage) {
    //     pageNum = 1;
    // }

    backlinkBlockNodeArraySort(validBacklinkBlockNodeArray, queryParams.backlinkBlockSortMethod);
    let pageBacklinkBlockArray = paginate(validBacklinkBlockNodeArray, pageNum, pageSize);
    let backlinkCacheData: IBacklinkCacheData = await batchGetBacklinkDoc(rootId, pageBacklinkBlockArray);
    // highlightBacklinkContent(backlinkCacheData.backlinks, queryParams.keywordStr);

    let backlinkDataArray = backlinkCacheData.backlinks;
    let usedCache = backlinkCacheData.usedCache;

    let filterCurDocDefBlockArray = filterExistingDefBlocks(
        backlinkPanelData.curDocDefBlockArray,
        validBacklinkBlockNodeArray,
        queryParams,
    );
    let filterRelatedDefBlockArray = filterExistingDefBlocks(
        backlinkPanelData.relatedDefBlockArray,
        validBacklinkBlockNodeArray,
        queryParams,
    );
    let filterBacklinkDocumentArray = filterBacklinkDocumentBlocks(
        backlinkPanelData.backlinkDocumentArray,
        validBacklinkBlockNodeArray,
        queryParams,
    );

    queryParams.pageNum = pageNum;


    let backlinkPanelRenderDataResult: IBacklinkPanelRenderData = {
        rootId,
        backlinkDataArray: backlinkDataArray,
        backlinkBlockNodeArray: validBacklinkBlockNodeArray,
        curDocDefBlockArray: filterCurDocDefBlockArray,
        relatedDefBlockArray: filterRelatedDefBlockArray,
        backlinkDocumentArray: filterBacklinkDocumentArray,
        pageNum,
        pageSize,
        totalPage,
        usedCache,
    };

    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `反链面板 生成渲染数据 : ${executionTime} ms, 内容大小 : ${getObjectSizeInKB(backlinkPanelRenderDataResult)}`,
    );

    return backlinkPanelRenderDataResult;
}


export async function getTurnPageBacklinkPanelRenderData(
    rootId: string,
    validBacklinkBlockNodeArray: IBacklinkBlockNode[],
    queryParams: IPanelRenderBacklinkQueryParams,
): Promise<IBacklinkPanelRenderData> {
    let pageNum = queryParams.pageNum;
    let pageSize = SettingService.ins.SettingConfig.pageSize;
    let totalPage = calculateTotalPages(validBacklinkBlockNodeArray.length, pageSize);
    if (pageNum < 1) {
        pageNum = 1;
    }
    if (pageNum > totalPage) {
        pageNum = totalPage;
    }

    backlinkBlockNodeArraySort(validBacklinkBlockNodeArray, queryParams.backlinkBlockSortMethod);
    let pageBacklinkBlockArray = paginate(validBacklinkBlockNodeArray, pageNum, pageSize);
    let backlinkCacheData: IBacklinkCacheData = await batchGetBacklinkDoc(rootId, pageBacklinkBlockArray);
    // highlightBacklinkContent(backlinkCacheData.backlinks, queryParams.keywordStr);

    let backlinkDataArray = backlinkCacheData.backlinks;
    let usedCache = backlinkCacheData.usedCache;
    let backlinkPanelRenderDataResult: IBacklinkPanelRenderData = {
        rootId,
        backlinkDataArray: backlinkDataArray,
        backlinkBlockNodeArray: null,
        curDocDefBlockArray: null,
        relatedDefBlockArray: null,
        backlinkDocumentArray: null,
        pageNum,
        pageSize,
        totalPage,
        usedCache,
    };
    return backlinkPanelRenderDataResult;
}


// 清理失效的查询条件，比如保存的一个查询定义块id，以前存在，现在不存在了。
function cleanInvalidQueryParams(
    queryParams: IPanelRenderBacklinkQueryParams,
    backlinkPanelData: IBacklinkFilterPanelData,
) {
    let invalidDefBlockId = new Set<string>();
    let invalidDocumentId = new Set<string>();

    let relatedDefBlockIds = getBlockIds([...backlinkPanelData.curDocDefBlockArray, ...backlinkPanelData.relatedDefBlockArray]);
    let backlinkDocumentIds = getBlockIds(backlinkPanelData.backlinkDocumentArray);


    for (const defBlockId of queryParams.includeRelatedDefBlockIds) {
        if (!relatedDefBlockIds.includes(defBlockId)) {
            invalidDefBlockId.add(defBlockId);
        }
    }
    for (const defBlockId of queryParams.excludeRelatedDefBlockIds) {
        if (!relatedDefBlockIds.includes(defBlockId)) {
            invalidDefBlockId.add(defBlockId);
        }
    }
    for (const defBlockId of queryParams.includeDocumentIds) {
        if (!backlinkDocumentIds.includes(defBlockId)) {
            invalidDocumentId.add(defBlockId);
        }
    }
    for (const defBlockId of queryParams.excludeDocumentIds) {
        if (!backlinkDocumentIds.includes(defBlockId)) {
            invalidDocumentId.add(defBlockId);
        }
    }

    for (const blockId of invalidDefBlockId) {
        queryParams.includeRelatedDefBlockIds.delete(blockId);
        queryParams.excludeRelatedDefBlockIds.delete(blockId);
    }
    for (const blockId of invalidDocumentId) {
        queryParams.includeDocumentIds.delete(blockId);
        queryParams.excludeDocumentIds.delete(blockId);
    }

}

function filterExistingDefBlocks(
    existingDefBlockArray: DefBlock[],
    validBacklinkBlockNodeArray: IBacklinkBlockNode[],
    queryParams: IPanelRenderBacklinkQueryParams,
): DefBlock[] {
    let existingDefBlockIdMap = formatDefBlockMap(existingDefBlockArray);
    let validDefBlockIdSet: Set<string> = new Set();
    let validDefBlockCountMap: Map<string, number> = new Map<string, number>();
    for (const backlinkBlockNode of validBacklinkBlockNodeArray) {
        let includeRelatedDefBlockIds = backlinkBlockNode.includeRelatedDefBlockIds;
        for (const blockId of includeRelatedDefBlockIds) {
            // 这一步主要是为了区分当前文档定义块和关联定义块.
            if (!existingDefBlockIdMap.has(blockId)) {
                continue;
            }
            updateMapCount(validDefBlockCountMap, blockId);
            validDefBlockIdSet.add(blockId);
        }
    }
    let includeRelatedDefBlockIds = queryParams.includeRelatedDefBlockIds;
    let excludeRelatedDefBlockIds = queryParams.excludeRelatedDefBlockIds;


    // 需要把包含（选中）的关联定义块ID加进去
    for (const defBlockId of includeRelatedDefBlockIds) {
        // 这一步主要是为了区分当前文档定义块和关联定义块.
        if (!existingDefBlockIdMap.has(defBlockId)) {
            continue;
        }
        validDefBlockIdSet.add(defBlockId);
    }

    // 需要把排除的关联定义块ID加进去
    for (const defBlockId of excludeRelatedDefBlockIds) {
        // 这一步主要是为了区分当前文档定义块和关联定义块.
        if (!existingDefBlockIdMap.has(defBlockId)) {
            continue;
        }
        validDefBlockIdSet.add(defBlockId);
    }

    let validDefBlockArray: DefBlock[] = [];

    for (let blockId of validDefBlockIdSet) {
        let defBlock = existingDefBlockIdMap.get(blockId);
        if (!defBlock) {
            continue;
        }
        let refCount = validDefBlockCountMap.get(defBlock.id);
        refCount = refCount ? refCount : 0;
        let selectionStatus = DefinitionBlockStatus.OPTIONAL;
        if (includeRelatedDefBlockIds.has(blockId)) {
            selectionStatus = DefinitionBlockStatus.SELECTED;
        }
        if (excludeRelatedDefBlockIds.has(blockId)) {
            selectionStatus = DefinitionBlockStatus.EXCLUDED;
        }
        defBlock.refCount = refCount;
        defBlock.selectionStatus = selectionStatus
        validDefBlockArray.push(defBlock);
    }

    return validDefBlockArray;
}


function filterBacklinkDocumentBlocks(
    existingDocBlockArray: DefBlock[],
    validBacklinkBlockNodeArray: IBacklinkBlockNode[],
    queryParams: IPanelRenderBacklinkQueryParams,
): DefBlock[] {
    let curDocBlockIdMap = formatDefBlockMap(existingDocBlockArray);
    let includeDocumentIds = queryParams.includeDocumentIds;
    let excludeDocumentIds = queryParams.excludeDocumentIds;

    let validDocBlockMap: Map<string, DefBlock> = new Map();
    for (const backlinkBlockNode of validBacklinkBlockNodeArray) {
        let blockRootId = backlinkBlockNode.block.root_id;
        let defBlock = validDocBlockMap.get(blockRootId);
        let refCount = 1;
        if (defBlock) {
            refCount = defBlock.refCount + 1;
        } else {
            defBlock = curDocBlockIdMap.get(blockRootId);
        }
        if (!defBlock) {
            continue;
        }

        let selectionStatus = DefinitionBlockStatus.OPTIONAL;
        if (includeDocumentIds.has(blockRootId)) {
            selectionStatus = DefinitionBlockStatus.SELECTED;
        }
        defBlock.selectionStatus = selectionStatus;
        defBlock.refCount = refCount;
        validDocBlockMap.set(blockRootId, defBlock);
    }
    //需要把包含（选中）的文档ID加进去
    for (const rootId of includeDocumentIds) {
        if (!validDocBlockMap.has(rootId)) {
            let defBlock = curDocBlockIdMap.get(rootId);
            let filterStatus = DefinitionBlockStatus.SELECTED;
            defBlock.selectionStatus = filterStatus
            validDocBlockMap.set(rootId, defBlock);
        }
    }
    //需要把排除的文档ID加进去
    for (const rootId of excludeDocumentIds) {
        let defBlock = curDocBlockIdMap.get(rootId);
        let filterStatus = DefinitionBlockStatus.EXCLUDED;
        defBlock.selectionStatus = filterStatus
        defBlock.refCount = 0;
        validDocBlockMap.set(rootId, defBlock);
    }
    let validDocBlockArray = Array.from(validDocBlockMap.values())

    return validDocBlockArray;
}

async function batchGetBacklinkDoc(
    curRootId: string,
    backlinkBlockNodeArray: IBacklinkBlockNode[],
): Promise<IBacklinkCacheData> {
    let defId = curRootId;
    let refTreeIdSet: Set<string> = new Set<string>();
    let refTreeIdKeyWorldMap = new Map<string, string>();
    // let refTreeIdDefIdsMap = new Map<string, string[]>();
    const backlinkBlockIdOrderMap = new Map<string, number>();
    const backlinkBlockMap = new Map<string, DefBlock>();
    for (const [index, node] of backlinkBlockNodeArray.entries()) {
        let backlinkRootId = node.block.root_id;
        refTreeIdSet.add(backlinkRootId);
        // 提取反链块中的共同关键字
        let backlinkContent = node.block.content;
        let keyword = refTreeIdKeyWorldMap.get(backlinkRootId);
        // keyword = "";
        if (keyword === undefined) {
            keyword = backlinkContent;
        } else {
            // 一手动态规划提取连续相同的字符串！ 好像出现一些字符串导致查询不到数据，需要观察一下。
            // 单引号无法查询 "'" ，在查询的时候过滤吧。
            keyword = longestCommonSubstring(keyword, backlinkContent);
        }
        refTreeIdKeyWorldMap.set(backlinkRootId, keyword);

        backlinkBlockIdOrderMap.set(node.block.id, index);
        backlinkBlockIdOrderMap.set(node.block.parent_id, index - 0.1);
        backlinkBlockMap.set(node.block.id, node.block);
        backlinkBlockMap.set(node.block.parent_id, node.block);
    }

    let usedCache = false;
    // 并发查询所有反链文档信息
    const allBacklinksArray: IBacklinkData[] = (
        await Promise.all(
            Array.from(refTreeIdKeyWorldMap.keys()).map(
                async (refTreeID) => {
                    let keyword = refTreeIdKeyWorldMap.get(refTreeID);
                    let data = await getBacklinkDocByApiOrCache(defId, refTreeID, keyword)
                    if (data.usedCache) {
                        usedCache = true;
                    }
                    return data.backlinks;
                },
            ),
        )
    ).flat();

    let backlinkDcoDataMap: Map<string, IBacklinkData> = new Map<string, IBacklinkData>();

    for (const backlink of allBacklinksArray) {
        let lastBreadcrumbId: string = getLastItem(backlink.blockPaths).id;
        if (backlinkDcoDataMap.has(lastBreadcrumbId)) {
            continue;
        }
        let backlinkBlockInfo: DefBlock = backlinkBlockMap.get(lastBreadcrumbId);
        if (backlinkBlockInfo) {
            backlink.dom = backlink.dom.replace(/search-mark/g, "");
            backlink.backlinkBlock = backlinkBlockInfo;
            backlinkDcoDataMap.set(lastBreadcrumbId, backlink)
        }
    }
    let backlinkDcoDataResult: IBacklinkData[] = Array.from(backlinkDcoDataMap.values());
    /* 排序 */
    // 根据 orderMap 中的顺序对 arr 进行排序
    backlinkDcoDataResult.sort((a, b) => {
        let aId = getLastItem(a.blockPaths).id;
        let bId = getLastItem(b.blockPaths).id;
        const indexA = backlinkBlockIdOrderMap.has(aId)
            ? backlinkBlockIdOrderMap.get(aId)!
            : Infinity;
        const indexB = backlinkBlockIdOrderMap.has(bId)
            ? backlinkBlockIdOrderMap.get(bId)!
            : Infinity;
        return indexA - indexB;
    });

    let result: IBacklinkCacheData = { backlinks: backlinkDcoDataResult, usedCache: usedCache };

    return result;
}

// 使用标签进行高亮，需要判断是否存在 span 标签，如果在 span 标签中，要进行分割，不能直接嵌套。太复杂了，放弃。
function highlightBacklinkContent(backlinkArray: IBacklinkData[], keywordStr: string) {
    if (!isValidStr(keywordStr)) {
        return;
    }
    let keywordArray = splitKeywordStringToArray(keywordStr);
    if (isArrayEmpty(keywordArray)) {
        return;
    }
    for (const backlink of backlinkArray) {
        console.log("highlightBacklinkContent before ", backlink.dom)
        // backlink.dom = highlightContent(backlink.dom, keywordArray);
        console.log("highlightBacklinkContent after ", backlink.dom)
    }
}

async function getBacklinkDocByApiOrCache(
    defId: string, refTreeID: string, keyword: string
): Promise<IBacklinkCacheData> {
    keyword = formatBacklinkDocApiKeyword(keyword);

    let backlinks = CacheManager.ins.getBacklinkDocApiData(defId, refTreeID, keyword);;
    let result: IBacklinkCacheData = { backlinks: backlinks, usedCache: false };
    if (backlinks) {
        result.usedCache = true;
        return result;
    }
    const startTime = performance.now(); // 记录开始时间
    const data: { backlinks: IBacklinkData[] } =
        await getBacklinkDoc(defId, refTreeID, keyword);
    backlinks = data.backlinks;
    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差

    let cacheAfterResponseMs = SettingService.ins.SettingConfig.cacheAfterResponseMs;
    let cacheExpirationTime = SettingService.ins.SettingConfig.cacheExpirationTime;

    if (cacheAfterResponseMs >= 0
        && cacheExpirationTime >= 0
        && executionTime > cacheAfterResponseMs) {
        CacheManager.ins.setBacklinkDocApiData(defId, refTreeID, keyword, data.backlinks, cacheExpirationTime);
    }

    result.backlinks = backlinks;
    result.usedCache = false;
    return result;
}

function formatBacklinkDocApiKeyword(keyword: string): string {
    if (!isValidStr(keyword)) {
        return "";
    }
    let keywordSplitArray = keyword.split("'");
    // 初始值设为空字符串
    let longestSubstring = "";
    // 遍历所有子字符串，找到最长的那个
    for (const substring of keywordSplitArray) {
        if (substring.length > longestSubstring.length) {
            longestSubstring = substring;
        }
    }
    if (longestSubstring.length > 100) {
        longestSubstring = longestSubstring.substring(0, 50);
    }
    // 返回最长的子字符串
    return longestSubstring;


}

function isBacklinkBlockValid(
    queryParams: IPanelRenderBacklinkQueryParams,
    backlinkBlockNode: IBacklinkBlockNode,
): boolean {
    let keywordStr = queryParams.backlinkKeywordStr;

    let includeRelatedDefBlockIds = queryParams.includeRelatedDefBlockIds;
    let excludeRelatedDefBlockIds = queryParams.excludeRelatedDefBlockIds;
    let includeDocumentIds = queryParams.includeDocumentIds;
    let excludeDocumentIds = queryParams.excludeDocumentIds;
    let backlinkCurDocDefBlockType = queryParams.backlinkCurDocDefBlockType;

    let backlinkBlockInfo = backlinkBlockNode.block;
    let backlinkConcatContent = backlinkBlockNode.concatContent;
    let backlinkDirectDefBlockIds = backlinkBlockNode.includeDirectDefBlockIds;
    let backlinkRelatedDefBlockIds = backlinkBlockNode.includeRelatedDefBlockIds;
    let dynamicAnchorMap = backlinkBlockNode.dynamicAnchorMap;
    let staticAnchorMap = backlinkBlockNode.staticAnchorMap;
    if (isSetNotEmpty(includeDocumentIds)
        && !includeDocumentIds.has(backlinkBlockInfo.root_id)
    ) {
        return false;
    }
    if (isSetNotEmpty(excludeDocumentIds)
        && excludeDocumentIds.has(backlinkBlockInfo.root_id)
    ) {
        return false;
    }
    if (isSetNotEmpty(includeRelatedDefBlockIds)) {
        for (const defBlockIds of includeRelatedDefBlockIds) {
            if (!backlinkRelatedDefBlockIds.has(defBlockIds)) {
                return false;
            }
        }
    }
    if (isSetNotEmpty(excludeRelatedDefBlockIds)) {
        for (const defBlockIds of excludeRelatedDefBlockIds) {
            if (backlinkRelatedDefBlockIds.has(defBlockIds)) {
                return false;
            }
        }
    }
    if (keywordStr) {
        let keywordArray = splitKeywordStringToArray(keywordStr);

        let containsAll = containsAllKeywords(backlinkConcatContent, keywordArray);
        if (!containsAll) {
            return false;
        }
    }

    if (backlinkCurDocDefBlockType) {
        if (backlinkCurDocDefBlockType == "dynamicAnchorText") {
            if (dynamicAnchorMap.size <= 0) {
                return false;
            } else {
                for (const blockId of dynamicAnchorMap.keys()) {
                    if (backlinkDirectDefBlockIds.has(blockId)) {
                        return true;
                    }
                }
                return false;
            }
        } else if (backlinkCurDocDefBlockType == "staticAnchorText") {
            if (staticAnchorMap.size <= 0) {
                return false;
            } else {
                for (const blockId of staticAnchorMap.keys()) {
                    if (backlinkDirectDefBlockIds.has(blockId)) {
                        return true;
                    }
                }
                return false;
            }
        }
    }


    return true;
}


export async function getBacklinkPanelData(
    queryParams: IBacklinkFilterPanelDataQueryParams
): Promise<IBacklinkFilterPanelData> {
    const startTime = performance.now(); // 记录开始时间
    let rootId = queryParams.rootId;

    let cacheResult = CacheManager.ins.getBacklinkPanelBaseData(rootId);;
    if (cacheResult) {
        cacheResult.userCache = true;
        return cacheResult;
    }


    let getCurDocDefBlockArraySql = generateGetDocDefBlockArraySql(queryParams);
    let curDocDefBlockArray: DefBlock[] = await sql(getCurDocDefBlockArraySql);
    if (isArrayEmpty(curDocDefBlockArray)) {
        let result: IBacklinkFilterPanelData = {
            rootId: rootId,
            backlinkBlockNodeArray: [],
            curDocDefBlockArray: [],
            relatedDefBlockArray: [],
            backlinkDocumentArray: [],
        }
        return result;
    }

    let defBlockIds = getBlockIds(curDocDefBlockArray);
    let backlinkBlockQueryParams: IBacklinkBlockQueryParams = {
        queryParentDefBlock: queryParams.queryParentDefBlock,
        querrChildDefBlockForListItem: queryParams.querrChildDefBlockForListItem,
        queryChildDefBlockForHeadline: queryParams.queryChildDefBlockForHeadline,
        defBlockIds: defBlockIds
    };

    let backlinkBlockArray: BacklinkBlock[] = await getBacklinkBlockArray(backlinkBlockQueryParams);
    backlinkBlockQueryParams.backlinkBlocks = backlinkBlockArray;
    backlinkBlockQueryParams.backlinkBlockIds = getBlockIds(backlinkBlockArray);

    let backlinkParentBlockArray: BacklinkParentBlock[] = await getParentBlockArray(backlinkBlockQueryParams);

    let backlinkChildBlockArray: BacklinkChildBlock[] = await getHeadlineChildBlockArray(backlinkBlockQueryParams);


    let backlinkPanelData = await buildBacklinkPanelData({ curDocDefBlockArray, backlinkBlockArray, backlinkChildBlockArray, backlinkParentBlockArray });

    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `反链面板 获取和处理数据消耗时间 : ${executionTime} ms`,
    );
    let cacheAfterResponseMs = SettingService.ins.SettingConfig.cacheAfterResponseMs;
    let cacheExpirationTime = SettingService.ins.SettingConfig.cacheExpirationTime;

    if (cacheAfterResponseMs >= 0
        && cacheExpirationTime >= 0
        && executionTime > cacheAfterResponseMs) {
        CacheManager.ins.setBacklinkPanelBaseData(rootId, backlinkPanelData, cacheExpirationTime);
    }
    // console.log(" blockTreeNodeArray : ", backlinkPanelData)

    return backlinkPanelData;
}

async function getBacklinkBlockArray(queryParams: IBacklinkBlockQueryParams): Promise<BacklinkBlock[]> {
    if (!queryParams) {
        return [];
    }
    let backlinkBlockArray: BacklinkBlock[];
    if (queryParams.querrChildDefBlockForListItem) {
        let backlinkListItemBlockArraySql = generateGetBacklinkListItemBlockArraySql(queryParams);
        backlinkBlockArray = await sql(backlinkListItemBlockArraySql);
    } else {
        let getBacklinkBlockArraySql = generateGetBacklinkBlockArraySql(queryParams);
        backlinkBlockArray = await sql(getBacklinkBlockArraySql);
    }
    backlinkBlockArray = backlinkBlockArray ? backlinkBlockArray : [];
    return backlinkBlockArray;
}


async function getHeadlineChildBlockArray(queryParams: IBacklinkBlockQueryParams)
    : Promise<BacklinkChildBlock[]> {
    if (!queryParams || !queryParams.queryChildDefBlockForHeadline) {
        return [];
    }

    let getHeadlineChildBlockSql = generateGetChildDefBlockArraySql(queryParams);
    let headlineChildBlockArray: BacklinkChildBlock[] = await sql(getHeadlineChildBlockSql);
    headlineChildBlockArray = headlineChildBlockArray ? headlineChildBlockArray : [];

    let backlinkChildBlockArray: BacklinkChildBlock[] = [];
    for (const childBlock of headlineChildBlockArray) {
        if (childBlock.parentIdPath.includes("->")) {
            backlinkChildBlockArray.push(childBlock);
        }
    }
    return backlinkChildBlockArray;
}

async function getParentBlockArray(queryParams: IBacklinkBlockQueryParams)
    : Promise<BacklinkParentBlock[]> {
    if (!queryParams || !queryParams.queryParentDefBlock) {
        return [];
    }

    let getParentBlockArraySql = generateGetParentDefBlockArraySql(queryParams);
    let parentBlockArray: BacklinkParentBlock[] = await sql(getParentBlockArraySql);
    parentBlockArray = parentBlockArray ? parentBlockArray : [];

    let backlinkParentListItemBlockIdSet: Set<string> = new Set<string>;
    for (const parentBlock of parentBlockArray) {
        if (parentBlock.type == 'i') {
            let count = countOccurrences(parentBlock.childIdPath, "->");
            // 用于过滤反链块所在的列表项块
            if (count > 2) {
                backlinkParentListItemBlockIdSet.add(parentBlock.id);
            }
        }
    }
    if (isSetNotEmpty(backlinkParentListItemBlockIdSet)) {
        queryParams.backlinkParentBlockIds = Array.from(backlinkParentListItemBlockIdSet);
        let getSubMarkdownSql = generateGetParenListItemtDefBlockArraySql(queryParams);
        let subMarkdownArray: BacklinkParentBlock[] = await sql(getSubMarkdownSql);
        subMarkdownArray = subMarkdownArray ? subMarkdownArray : [];
        let subMarkdownMap = new Map<string, string>();
        for (const parentListItemBlock of subMarkdownArray) {
            subMarkdownMap.set(parentListItemBlock.parent_id, parentListItemBlock.subMarkdown);
        }
        for (const parentBlock of parentBlockArray) {
            if (parentBlock.type == 'i') {
                let subMarkdown = subMarkdownMap.get(parentBlock.id);
                if (subMarkdown) {
                    parentBlock.subMarkdown = subMarkdown;
                }
            }
        }
    }


    return parentBlockArray;

}


function getBlockIds(blockList: DefBlock[]): string[] {
    let blockIds: string[] = [];
    if (!blockList || blockList.length == 0) {
        return blockIds
    }
    for (const block of blockList) {
        if (!block) {
            continue;
        }
        blockIds.push(block.id);
    }

    return blockIds;
}

async function buildBacklinkPanelData(
    paramObj: {
        curDocDefBlockArray: DefBlock[],
        backlinkBlockArray: BacklinkBlock[],
        backlinkChildBlockArray: BacklinkChildBlock[],
        backlinkParentBlockArray: BacklinkParentBlock[],
    }
): Promise<IBacklinkFilterPanelData> {
    let defBlockIdArray = getBlockIds(paramObj.curDocDefBlockArray);

    // 创建一个id到节点的映射
    const backlinkBlockMap: { [key: string]: IBacklinkBlockNode } = {};
    let relatedDefBlockCountMap = new Map<string, number>();
    let backlinkDocumentCountMap = new Map<string, number>();
    let relatedDefBlockDynamicAnchorMap = new Map<string, Set<string>>();
    let relatedDefBlockStaticAnchorMap = new Map<string, Set<string>>();
    // 整个活，把关联的块的时间修改为反链块的时间。 map 的键是关联块的id
    let backlinkBlockCreatedMap = new Map<string, string>();
    let backlinkBlockUpdatedMap = new Map<string, string>();

    for (const backlinkBlock of paramObj.backlinkBlockArray) {
        let backlinkBlockNode: IBacklinkBlockNode = {
            block: { ...backlinkBlock, refCount: null },
            documentBlock: null,
            concatContent: "",
            includeDirectDefBlockIds: new Set<string>(),
            includeRelatedDefBlockIds: new Set<string>(),
            dynamicAnchorMap: new Map<string, Set<string>>(),
            staticAnchorMap: new Map<string, Set<string>>(),
        };
        let markdown = backlinkBlock.markdown;
        let content = backlinkBlock.content;
        if (backlinkBlock.parentBlockType == 'i' && backlinkBlock.parentListItemMarkdown) {
            markdown = backlinkBlock.parentListItemMarkdown;
            content = backlinkBlock.parentListItemMarkdown;
        }
        let relatedDefBlockIdArray = getRefBlockId(markdown);
        for (const relatedDefBlockId of relatedDefBlockIdArray) {
            backlinkBlockNode.includeRelatedDefBlockIds.add(relatedDefBlockId)
            if (defBlockIdArray.includes(relatedDefBlockId)) {
                backlinkBlockNode.includeDirectDefBlockIds.add(relatedDefBlockId);
            } else {
                updateMaxValueMap(backlinkBlockCreatedMap, relatedDefBlockId, backlinkBlock.created);
                updateMaxValueMap(backlinkBlockUpdatedMap, relatedDefBlockId, backlinkBlock.updated);
                updateMapCount(relatedDefBlockCountMap, relatedDefBlockId);
            }

        }
        updateDynamicAnchorMap(backlinkBlockNode.dynamicAnchorMap, backlinkBlock.markdown);
        updateStaticAnchorMap(backlinkBlockNode.staticAnchorMap, backlinkBlock.markdown);

        backlinkBlockNode.concatContent += content;
        updateMaxValueMap(backlinkBlockCreatedMap, backlinkBlock.root_id, backlinkBlock.created);
        updateMaxValueMap(backlinkBlockUpdatedMap, backlinkBlock.root_id, backlinkBlock.updated);
        updateMapCount(backlinkDocumentCountMap, backlinkBlock.root_id);
        // 更新所有关联块的静态锚文本
        updateDynamicAnchorMap(relatedDefBlockDynamicAnchorMap, markdown);
        updateStaticAnchorMap(relatedDefBlockStaticAnchorMap, markdown);
        backlinkBlockMap[backlinkBlockNode.block.id] = backlinkBlockNode;
    }
    // 这里必须再生成一个关联块ID Set，用来区分下面父级关联块 markdown 中存在该关联块，防止set里的关联块重新计数
    let relatedDefBlockIdSet = new Set(relatedDefBlockCountMap.keys());

    for (const childBlock of paramObj.backlinkChildBlockArray) {
        let markdown = childBlock.markdown;
        let backlnikChildDefBlockIdArray = getRefBlockId(markdown);
        let backlinkBlockId = childBlock.parentIdPath.split("->")[0];
        let backlinkBlockNode = backlinkBlockMap[backlinkBlockId];
        if (backlinkBlockNode) {
            for (const childDefBlockId of backlnikChildDefBlockIdArray) {
                backlinkBlockNode.includeRelatedDefBlockIds.add(childDefBlockId);
                if (defBlockIdArray.includes(childDefBlockId)) {
                    backlinkBlockNode.includeDirectDefBlockIds.add(childDefBlockId);
                } else if (!relatedDefBlockIdSet.has(childDefBlockId)) {
                    updateMapCount(relatedDefBlockCountMap, childDefBlockId);
                }
            }
            backlinkBlockNode.concatContent += markdown;
            updateDynamicAnchorMap(relatedDefBlockDynamicAnchorMap, markdown);
            updateStaticAnchorMap(relatedDefBlockStaticAnchorMap, markdown);
        }
    }


    for (const parentBlock of paramObj.backlinkParentBlockArray) {
        let markdown = parentBlock.markdown;
        if (parentBlock.type == 'i' && parentBlock.subMarkdown) {
            markdown = parentBlock.subMarkdown;
        }
        let backlnikParentDefBlockIdArray = getRefBlockId(markdown);
        let backlinkBlockId = parentBlock.childIdPath.split("->")[0];
        let backlinkBlockNode = backlinkBlockMap[backlinkBlockId];
        if (backlinkBlockNode) {
            for (const parentDefBlockId of backlnikParentDefBlockIdArray) {
                backlinkBlockNode.includeRelatedDefBlockIds.add(parentDefBlockId);
                if (defBlockIdArray.includes(parentDefBlockId)) {
                    backlinkBlockNode.includeDirectDefBlockIds.add(parentDefBlockId);
                } else if (!relatedDefBlockIdSet.has(parentDefBlockId)) {
                    updateMapCount(relatedDefBlockCountMap, parentDefBlockId);
                }
            }
            backlinkBlockNode.concatContent += markdown;
            updateDynamicAnchorMap(relatedDefBlockDynamicAnchorMap, markdown);
            updateStaticAnchorMap(relatedDefBlockStaticAnchorMap, markdown);
            // updateMapCount(backlinkDocumentCountMap, parentBlock.root_id);
        }
    }

    const combinedKeys = [...relatedDefBlockCountMap.keys(), ...backlinkDocumentCountMap.keys()];

    let relatedDefBlockAndDocumentMap = await getBlockInfoMap(combinedKeys);

    let relatedDefBlockArray: DefBlock[] = [];
    let backlinkDocumentArray: DefBlock[] = [];

    for (const key of relatedDefBlockCountMap.keys()) {
        let blockCount = relatedDefBlockCountMap.get(key);
        let blockInfo = relatedDefBlockAndDocumentMap.get(key);
        if (blockInfo) {
            let refBlockInfo: DefBlock = {
                ...blockInfo,
                refCount: blockCount,
                selectionStatus: DefinitionBlockStatus.OPTIONAL
            };
            let created = backlinkBlockCreatedMap.get(blockInfo.id);
            refBlockInfo.created = created ? created : refBlockInfo.created;
            let updated = backlinkBlockUpdatedMap.get(blockInfo.id);
            refBlockInfo.updated = updated ? updated : refBlockInfo.updated;
            relatedDefBlockArray.push(refBlockInfo);
            let dnaymicAnchor = "";
            let staticAnchor = "";
            let dynamicAnchorSet = relatedDefBlockDynamicAnchorMap.get(blockInfo.id);
            if (dynamicAnchorSet) {
                dnaymicAnchor = Array.from(dynamicAnchorSet).join(' ');
            }
            let staticAnchorSet = relatedDefBlockStaticAnchorMap.get(blockInfo.id);
            if (staticAnchorSet) {
                staticAnchor = Array.from(staticAnchorSet).join(' ');
            }
            refBlockInfo.dynamicAnchor = dnaymicAnchor
            refBlockInfo.staticAnchor = staticAnchor;
        }
    }

    for (const key of backlinkDocumentCountMap.keys()) {
        let blockCount = backlinkDocumentCountMap.get(key);
        let blockInfo = relatedDefBlockAndDocumentMap.get(key);
        if (blockInfo) {
            let documentBlockInfo: DefBlock = {
                ...blockInfo,
                refCount: blockCount,
                selectionStatus: DefinitionBlockStatus.OPTIONAL
            };
            let created = backlinkBlockCreatedMap.get(blockInfo.id);
            documentBlockInfo.created = created ? created : documentBlockInfo.created;
            let updated = backlinkBlockUpdatedMap.get(blockInfo.id);
            documentBlockInfo.updated = updated ? updated : documentBlockInfo.updated;
            backlinkDocumentArray.push(documentBlockInfo);
        }
    }

    // 关联反链块所在的文档块信息
    for (const node of Object.values(backlinkBlockMap)) {
        let docBlockInfo = relatedDefBlockAndDocumentMap.get(node.block.root_id);
        node.documentBlock = docBlockInfo;
    }

    let rootId = paramObj.curDocDefBlockArray[0].root_id;
    let backlinkBlockNodeArray: IBacklinkBlockNode[] = Object.values(backlinkBlockMap);

    let backlinkPanelData: IBacklinkFilterPanelData = {
        rootId,
        backlinkBlockNodeArray,
        curDocDefBlockArray: paramObj.curDocDefBlockArray,
        relatedDefBlockArray,
        backlinkDocumentArray: backlinkDocumentArray,
    };

    return backlinkPanelData;

}

async function getBlockInfoMap(blockIds: string[]) {
    let getBlockArraySql = generateGetBlockArraySql(blockIds);
    let blockArray: DefBlock[] = await sql(getBlockArraySql);
    blockArray = blockArray ? blockArray : [];
    let blockMap = new Map<string, DefBlock>();
    for (const block of blockArray) {
        blockMap.set(block.id, block);
    }
    return blockMap;
}


function getRefBlockId(markdown: string): string[] {
    const matches = [];
    if (!markdown) {
        return matches;
    }

    let regex = /\(\((\d{14}-\w{7})\s'[^']+'\)\)/g;
    regex = /\(\((\d{14}-\w{7})\s['"][^'"]+['"]\)\)/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
        matches.push(match[1]);
    }
    return matches;
}


function getRootBlockIdArray(blockTreeNodeArray: IBacklinkBlockNode[]) {
    let rootBlockIdArray = [];
    if (!blockTreeNodeArray) {
        return rootBlockIdArray;
    }
    for (const node of blockTreeNodeArray) {
        rootBlockIdArray.push(node.block.id);
    }
    return rootBlockIdArray;
}


async function backlinkBlockNodeArraySort(
    backlinkBlockArray: IBacklinkBlockNode[],
    blockSortMethod: BlockSortMethod,
) {
    if (!backlinkBlockArray || backlinkBlockArray.length <= 0) {
        return;
    }

    let backlinkBlockNodeSortFun;
    switch (blockSortMethod) {
        case "documentAlphabeticAsc":
            backlinkBlockNodeSortFun = function (
                a: IBacklinkBlockNode,
                b: IBacklinkBlockNode,
            ): number {
                let aContent = a.documentBlock.content.replace("<mark>", "").replace("</mark>", "");
                let bContent = b.documentBlock.content.replace("<mark>", "").replace("</mark>", "");
                let result = aContent.localeCompare(bContent, undefined, { sensitivity: 'base', usage: 'sort', numeric: true });
                if (result == 0) {
                    result = Number(a.block.updated) - Number(b.block.updated);
                }
                return result;
            };
            break;
        case "documentAlphabeticDesc":
            backlinkBlockNodeSortFun = function (
                a: IBacklinkBlockNode,
                b: IBacklinkBlockNode,
            ): number {
                let aContent = a.documentBlock.content.replace("<mark>", "").replace("</mark>", "");
                let bContent = b.documentBlock.content.replace("<mark>", "").replace("</mark>", "");
                let result = bContent.localeCompare(aContent, undefined, { sensitivity: 'base', usage: 'sort', numeric: true });
                if (result == 0) {
                    result = Number(b.block.updated) - Number(a.block.updated);
                }
                return result;
            };
            break;
        default:
            let blockSortFun: (
                a: DefBlock,
                b: DefBlock,
            ) => number = getDefBlockSortFun(blockSortMethod);
            if (blockSortFun) {
                backlinkBlockNodeSortFun = (a: IBacklinkBlockNode, b: IBacklinkBlockNode): number => {
                    let aBlock = a.block;
                    let bBlock = b.block;
                    return blockSortFun(aBlock, bBlock);
                };

            }
            break;
    }

    if (backlinkBlockNodeSortFun) {
        backlinkBlockArray.sort(backlinkBlockNodeSortFun);
    }
}


export async function defBlockArraySort(
    defBlockArray: DefBlock[],
    defBlockSortMethod: BlockSortMethod,
) {
    if (isArrayEmpty(defBlockArray)
        || !defBlockSortMethod
    ) {
        return;
    }
    if (defBlockSortMethod == "content") {
        await searchItemSortByContent(defBlockArray);
    } else if (defBlockSortMethod == "typeAndContent") {
        await searchItemSortByTypeAndContent(defBlockArray);
    } else {
        let blockSortFun: (
            a: DefBlock,
            b: DefBlock,
        ) => number = getDefBlockSortFun(defBlockSortMethod);
        if (blockSortFun) {
            defBlockArray.sort(blockSortFun);
        }
    }
}

export async function defBlockArrayTypeAndKeywordFilter(
    defBlockArray: DefBlock[],
    defBLockType: string,
    keywordStr: string,
) {
    if (isArrayEmpty(defBlockArray)) {
        return;
    }
    for (const defBlock of defBlockArray) {
        defBlock.filterStatus = false;
    }

    if (defBLockType) {
        for (const defBlock of defBlockArray) {
            if (defBLockType == "dynamicAnchorText" && !isValidStr(defBlock.dynamicAnchor)) {
                console.log("dynamicAnchorText defBlock ", defBlock)
                defBlock.filterStatus = true;
            } else if (defBLockType == "staticAnchorText" && !isValidStr(defBlock.staticAnchor)) {
                console.log("staticAnchorText defBlock ", defBlock)
                defBlock.filterStatus = true;
            }
        }
    }
    let keywordArray = splitKeywordStringToArray(keywordStr);
    if (isArrayEmpty(keywordArray)) {
        return;
    }
    for (const defBlock of defBlockArray) {
        let staticAnchor = defBlock.staticAnchor ? defBlock.staticAnchor + "-static- -静态锚文本- -锚- -锚链接-" : "";
        let blockContent = defBlock.content + defBlock.name + defBlock.alias + defBlock.memo + staticAnchor;
        let containsAll = containsAllKeywords(blockContent, keywordArray);
        if (!containsAll) {
            defBlock.filterStatus = true;
        }
    }
}



async function searchItemSortByContent(blockArray: DefBlock[]) {
    let ids = blockArray.map(item => item.id);
    let idMap: Map<string, number> = await getBatchBlockIdIndex(ids);
    blockArray.sort((a, b) => {
        let statusNum = getFilterStatusSortResult(a, b);
        if (statusNum != null) {
            return statusNum;
        }
        let aIndex = idMap.get(a.id) || 0;
        let bIndex = idMap.get(b.id) || 0;
        let result = aIndex - bIndex;
        if (result == 0) {
            result = Number(a.created) - Number(b.created);
        }
        if (result == 0) {
            result = a.sort - b.sort;
        }
        return result;
    });

    return blockArray;
}


async function searchItemSortByTypeAndContent(blockArray: DefBlock[]) {
    let ids = blockArray.map(item => item.id);
    let idMap: Map<string, number> = await getBatchBlockIdIndex(ids);
    blockArray.sort((a, b) => {
        let statusNum = getFilterStatusSortResult(a, b);
        if (statusNum != null) {
            return statusNum;
        }

        let result = a.sort - b.sort;
        if (result == 0) {
            let aIndex = idMap.get(a.id) || 0;
            let bIndex = idMap.get(b.id) || 0;
            result = aIndex - bIndex;
        }
        if (result == 0) {
            result = Number(b.refCount) - Number(a.refCount);
        }
        return result;
    });

    return blockArray;
}


function getDefBlockSortFun(contentBlockSortMethod: BlockSortMethod) {
    let blockSortFun: (
        a: DefBlock,
        b: DefBlock,
    ) => number;
    switch (contentBlockSortMethod) {
        case "type":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                let result = a.sort - b.sort;
                if (result == 0) {
                    result = Number(b.updated) - Number(a.updated);
                }
                return result;
            };
            break;
        case "modifiedAsc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                return Number(a.updated) - Number(b.updated);
            };
            break;
        case "modifiedDesc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                return Number(b.updated) - Number(a.updated);
            };
            break;
        case "createdAsc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                return Number(a.created) - Number(b.created);
            };
            break;
        case "createdDesc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                return Number(b.created) - Number(a.created);
            };
            break;
        case "refCountAsc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                return Number(a.refCount) - Number(b.refCount);
            };
            break;
        case "refCountDesc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                return Number(b.refCount) - Number(a.refCount);
            };
            break;
        case "alphabeticAsc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                let aContent = a.content.replace("<mark>", "").replace("</mark>", "");
                let bContent = b.content.replace("<mark>", "").replace("</mark>", "");
                let result = aContent.localeCompare(bContent, undefined, { sensitivity: 'base', usage: 'sort', numeric: true });
                if (result == 0) {
                    result = Number(b.updated) - Number(a.updated);
                }
                return result;
            };
            break;
        case "alphabeticDesc":
            blockSortFun = function (
                a: DefBlock,
                b: DefBlock,
            ): number {
                let statusNum = getFilterStatusSortResult(a, b);
                if (statusNum != null) {
                    return statusNum;
                }

                let aContent = a.content.replace("<mark>", "").replace("</mark>", "");
                let bContent = b.content.replace("<mark>", "").replace("</mark>", "");
                let result = bContent.localeCompare(aContent, undefined, { sensitivity: 'base', usage: 'sort', numeric: true });
                if (result == 0) {
                    result = Number(b.updated) - Number(a.updated);
                }
                return result;
            };
            break;
    }
    return blockSortFun;

}

function getFilterStatusSortResult(a: DefBlock, b: DefBlock): number {
    if (a.selectionStatus !== b.selectionStatus) {
        if (a.selectionStatus == "SELECTED") {
            return -1;
        } else if (b.selectionStatus == "SELECTED") {
            return 1;
        } else if (a.selectionStatus == "EXCLUDED") {
            return -1;
        } else if (b.selectionStatus == "EXCLUDED") {
            return 1;
        }
    }
    return null;
}

function updateMaxValueMap(map: Map<string, string>, key: string, value: string) {
    if (!value) {
        return;
    }
    let oldValue = map.get(key);
    if (!oldValue || parseFloat(oldValue) < parseFloat(value)) {
        map.set(key, value);
    }
}

function updateMapCount(map: Map<string, number>, key: string, initialValue = 1) {
    let refCount = map.get(key);
    refCount = refCount ? refCount + 1 : initialValue;
    map.set(key, refCount);
}

function updateDynamicAnchorMap(map: Map<string, Set<string>>, markdown: string) {
    let regex = /\(\((\d{14}-\w{7})\s'([^']+)'\)\)/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
        let id = match[1];
        let anchor = match[2];
        if (id && anchor) {
            let anchorSet = map.get(id);
            anchorSet = anchorSet ? anchorSet : new Set<string>();
            anchorSet.add(anchor);
            map.set(id, anchorSet);
        }
    }
}

function updateStaticAnchorMap(map: Map<string, Set<string>>, markdown: string) {
    let regex = /\(\((\d{14}-\w{7})\s"([^"]+)"\)\)/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
        let id = match[1];
        let anchor = match[2];
        if (id && anchor) {
            let anchorSet = map.get(id);
            anchorSet = anchorSet ? anchorSet : new Set<string>();
            anchorSet.add(anchor);
            map.set(id, anchorSet);
        }
    }
}



function calculateTotalPages(totalItems: number, itemsPerPage: number): number {
    if (itemsPerPage <= 0) {
        return 0;
    }
    return Math.ceil(totalItems / itemsPerPage);
}

function formatDefBlockMap(defBlockArray: DefBlock[])
    : Map<string, DefBlock> {
    let map: Map<string, DefBlock> = new Map();
    if (!defBlockArray) {
        return map;
    }
    for (const defBlock of defBlockArray) {
        map.set(defBlock.id, defBlock);
    }

    return map;
}