import { sql, getBatchBlockIdIndex, getBacklinkDoc } from "@/utils/api";
import { generateGetParentDefBlockArraySql as generateGetParentBlockArraySql, generateGetBacklinkListItemBlockArraySql, generateGetDefBlockArraySql as generateGetDocDefBlockArraySql, generateGetBlockArraySql, generateGetParenListItemtDefBlockArraySql, generateGetChildDefBlockArraySql, generateGetBacklinkBlockArraySql } from "./backlink-sql";
import { BacklinkPanelData, RelatedBlockQueryCriteria, BacklinkBlockNode, DefBlockQueryCriteria, BacklinkPanelRenderQueryCondition, BacklinkPanelRenderData } from "@/models/backlink-model";
import { getObjectSizeInKB } from "@/utils/object-util";
import { containsAllKeywords, countOccurrences, longestCommonSubstring } from "@/utils/string-util";
import { getLastItem, isArrayEmpty, isSetNotEmpty, paginate } from "@/utils/array-util";
import { DefinitionBlockStatus } from "@/models/backlink-constant";
import { BacklinkDocCache } from "@/utils/cache-util";




export async function getBacklinkPanelRenderData(
    backlinkPanelData: BacklinkPanelData,
    queryCriteria: BacklinkPanelRenderQueryCondition,
): Promise<BacklinkPanelRenderData> {
    const startTime = performance.now(); // 记录开始时间

    if (!backlinkPanelData || !queryCriteria) {
        return
    }
    let pageNum = queryCriteria.pageNum;
    let pageSize = queryCriteria.pageSize;
    let rootId = backlinkPanelData.rootId;
    cleanInvalidQueryParams(queryCriteria, backlinkPanelData);

    let backlinkBlockNodeArray = backlinkPanelData.backlinkBlockNodeArray;
    let validBacklinkBlockNodeArray: BacklinkBlockNode[] = [];
    for (const backlinkBlockNode of backlinkBlockNodeArray) {
        let valid = isBacklinkBlockValid(queryCriteria, backlinkBlockNode);
        if (!valid) {
            continue;
        }
        validBacklinkBlockNodeArray.push(backlinkBlockNode);
    }

    backlinkBlockNodeArraySort(validBacklinkBlockNodeArray, queryCriteria.backlinkBlockSortMethod);
    let pageBacklinkBlockArray = paginate(validBacklinkBlockNodeArray, pageNum, pageSize);
    let backlinkCacheData: IBacklinkCacheData = await batchGetBacklinkDoc(rootId, pageBacklinkBlockArray);

    let backlinkDocArray = backlinkCacheData.backlinks;
    let usedCache = backlinkCacheData.usedCache;

    let filterCurDocDefBlockArray = filterExistingDefBlocks(
        backlinkPanelData.curDocDefBlockArray,
        validBacklinkBlockNodeArray,
        queryCriteria,
    );
    let filterRelatedDefBlockArray = filterExistingDefBlocks(
        backlinkPanelData.relatedDefBlockArray,
        validBacklinkBlockNodeArray,
        queryCriteria,
    );
    let filterRelatedDocumentArray = filterReletedDocumentBlocks(
        backlinkPanelData.relatedDocumentArray,
        validBacklinkBlockNodeArray,
        queryCriteria,
    );

    // 页面中可以指定顺序，在页面中排序
    // defBlockArraySort(filterCurDocDefBlockArray, "typeAndContent");
    // defBlockArraySort(filterRelatedDefBlockArray, "refCountDesc");
    // defBlockArraySort(filterRelatedDocumentArray, "modifiedDesc");

    let totalPage = calculateTotalPages(validBacklinkBlockNodeArray.length, pageSize);

    let backlinkPanelRenderDataResult: BacklinkPanelRenderData = {
        rootId,
        backlinkDocArray,
        backlinkBlockNodeArray: validBacklinkBlockNodeArray,
        curDocDefBlockArray: filterCurDocDefBlockArray,
        relatedDefBlockArray: filterRelatedDefBlockArray,
        relatedDocumentArray: filterRelatedDocumentArray,
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
    // console.log(" backlinkPanelRenderDataResult : ", backlinkPanelRenderDataResult);

    return backlinkPanelRenderDataResult;
}

// 清理失效的查询条件，比如保存的一个查询定义块id，以前存在，现在不存在了。
function cleanInvalidQueryParams(
    queryCriteria: BacklinkPanelRenderQueryCondition,
    backlinkPanelData: BacklinkPanelData,
) {
    let invalidDefBlockId = new Set<string>();
    let invalidDocumentId = new Set<string>();

    let relatedDefBlockIds = getBlockIds(backlinkPanelData.relatedDefBlockArray);
    let relatedDocumentIds = getBlockIds(backlinkPanelData.relatedDocumentArray);


    for (const defBlockId of queryCriteria.includeRelatedDefBlockIds) {
        if (!relatedDefBlockIds.includes(defBlockId)) {
            invalidDefBlockId.add(defBlockId);
        }
    }
    for (const defBlockId of queryCriteria.excludeRelatedDefBlockIds) {
        if (!relatedDefBlockIds.includes(defBlockId)) {
            invalidDefBlockId.add(defBlockId);
        }
    }
    for (const defBlockId of queryCriteria.includeDocumentIds) {
        if (!relatedDocumentIds.includes(defBlockId)) {
            invalidDocumentId.add(defBlockId);
        }
    }
    for (const defBlockId of queryCriteria.excludeDocumentIds) {
        if (!relatedDocumentIds.includes(defBlockId)) {
            invalidDocumentId.add(defBlockId);
        }
    }

    for (const blockId of invalidDefBlockId) {
        queryCriteria.includeRelatedDefBlockIds.delete(blockId);
        queryCriteria.excludeRelatedDefBlockIds.delete(blockId);
    }
    for (const blockId of invalidDocumentId) {
        queryCriteria.includeDocumentIds.delete(blockId);
        queryCriteria.excludeDocumentIds.delete(blockId);
    }

}

function filterExistingDefBlocks(
    existingDefBlockArray: DefBlock[],
    validBacklinkBlockNodeArray: BacklinkBlockNode[],
    queryCriteria: BacklinkPanelRenderQueryCondition,
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
    let includeRelatedDefBlockIds = queryCriteria.includeRelatedDefBlockIds;
    let excludeRelatedDefBlockIds = queryCriteria.excludeRelatedDefBlockIds;


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


function filterReletedDocumentBlocks(
    existingDocBlockArray: DefBlock[],
    validBacklinkBlockNodeArray: BacklinkBlockNode[],
    queryCriteria: BacklinkPanelRenderQueryCondition,
): DefBlock[] {
    let curDocBlockIdMap = formatDefBlockMap(existingDocBlockArray);
    let includeDocumentIds = queryCriteria.includeDocumentIds;
    let excludeDocumentIds = queryCriteria.excludeDocumentIds;

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
    backlinkBlockNodeArray: BacklinkBlockNode[],
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
        if (keyword === undefined) {
            keyword = backlinkContent;
        } else {
            // 一手动态规划提取连续相同的字符串！
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

async function getBacklinkDocByApiOrCache(
    defId: string, refTreeID: string, keyword: string
): Promise<IBacklinkCacheData> {
    let cacheKey = BacklinkDocCache.ins.generateKey(defId, refTreeID, keyword);
    let backlinks = BacklinkDocCache.ins.get(cacheKey);
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
    if (executionTime > 500) {
        BacklinkDocCache.ins.set(cacheKey, data.backlinks, 60000);
    }

    result.backlinks = backlinks;
    result.usedCache = false;
    return result;
}

function isBacklinkBlockValid(
    queryCriteria: BacklinkPanelRenderQueryCondition,
    backlinkBlockNode: BacklinkBlockNode,
): boolean {
    let keywordStr = queryCriteria.keywordStr;

    let includeRelatedDefBlockIds = queryCriteria.includeRelatedDefBlockIds;
    let excludeRelatedDefBlockIds = queryCriteria.excludeRelatedDefBlockIds;
    let includeDocumentIds = queryCriteria.includeDocumentIds;
    let excludeDocumentIds = queryCriteria.excludeDocumentIds;

    let backlinkBlockInfo = backlinkBlockNode.block;
    let backlinkConcatContent = backlinkBlockNode.concatContent;
    let backlinkDefBlockIds = backlinkBlockNode.includeRelatedDefBlockIds;
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
            if (!backlinkDefBlockIds.has(defBlockIds)) {
                return false;
            }
        }
    }
    if (isSetNotEmpty(excludeRelatedDefBlockIds)) {
        for (const defBlockIds of excludeRelatedDefBlockIds) {
            if (backlinkDefBlockIds.has(defBlockIds)) {
                return false;
            }
        }
    }
    if (keywordStr) {
        // 分离空格
        let keywordArray = keywordStr.trim().replace(/\s+/g, " ").split(" ");
        // 去重
        keywordArray = Array.from(new Set(
            keywordArray.filter((keyword) => keyword.length > 0),
        ));
        let containsAll = containsAllKeywords(backlinkConcatContent, keywordArray);
        if (!containsAll) {
            return false;
        }
    }
    return true;
}


export async function getBacklinkPanelData(
    defBlockQueryCriteria: DefBlockQueryCriteria
): Promise<BacklinkPanelData> {
    const startTime = performance.now(); // 记录开始时间
    let getCurDocDefBlockArraySql = generateGetDocDefBlockArraySql(defBlockQueryCriteria);
    let curDocDefBlockArray: DefBlock[] = await sql(getCurDocDefBlockArraySql);
    if (isArrayEmpty(curDocDefBlockArray)) {
        let result: BacklinkPanelData = {
            rootId: defBlockQueryCriteria.rootId,
            backlinkBlockNodeArray: [],
            curDocDefBlockArray: [],
            relatedDefBlockArray: [],
            relatedDocumentArray: [],
        }
        return result;
    }

    let defBlockIds = getBlockIds(curDocDefBlockArray);
    defBlockQueryCriteria.defBlockIds = defBlockIds;

    let backlinkBlockArray: BacklinkBlock[] = await getBacklinkBLockarry(defBlockQueryCriteria);


    let backlinkChildBlockArray: BacklinkChildBlock[] = await getHeadlineChildBlockArray(defBlockQueryCriteria);


    let backlinkParentBlockArray = await getParentBlockArray(defBlockQueryCriteria);

    let backlinkPanelData = await buildBacklinkPanelData({ curDocDefBlockArray, backlinkBlockArray, backlinkChildBlockArray, backlinkParentBlockArray });

    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `反链面板 获取和处理数据消耗时间 : ${executionTime} ms`,
    );
    // console.log(" blockTreeNodeArray : ", backlinkPanelData)


    return backlinkPanelData;
}

async function getBacklinkBLockarry(queryCriteria: DefBlockQueryCriteria): Promise<BacklinkBlock[]> {
    if (!queryCriteria) {
        return [];
    }
    let backlinkBlockArray: BacklinkBlock[];
    let relatedBlockQueryCriteria: RelatedBlockQueryCriteria = { defBlockIds: queryCriteria.defBlockIds }
    if (queryCriteria.querrChildDefBlockForListItem) {
        let backlinkListItemBlockArraySql = generateGetBacklinkListItemBlockArraySql(relatedBlockQueryCriteria);
        backlinkBlockArray = await sql(backlinkListItemBlockArraySql);
    } else {
        let getBacklinkBlockArraySql = generateGetBacklinkBlockArraySql(relatedBlockQueryCriteria);
        backlinkBlockArray = await sql(getBacklinkBlockArraySql);
    }
    backlinkBlockArray = backlinkBlockArray ? backlinkBlockArray : [];
    return backlinkBlockArray;
}


async function getHeadlineChildBlockArray(queryCriteria: DefBlockQueryCriteria)
    : Promise<BacklinkChildBlock[]> {
    if (!queryCriteria || !queryCriteria.queryChildDefBlockForHeadline) {
        return [];
    }
    let relatedBlockQueryCriteria: RelatedBlockQueryCriteria = { defBlockIds: queryCriteria.defBlockIds }
    let getHeadlineChildBlockSql = generateGetChildDefBlockArraySql(relatedBlockQueryCriteria);
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

async function getParentBlockArray(queryCriteria: DefBlockQueryCriteria)
    : Promise<BacklinkParentBlock[]> {
    if (!queryCriteria || !queryCriteria.queryParentDefBlock) {
        return [];
    }

    let relatedBlockQueryCriteria: RelatedBlockQueryCriteria = { defBlockIds: queryCriteria.defBlockIds }
    let getParentBlockArraySql = generateGetParentBlockArraySql(relatedBlockQueryCriteria);
    let parentBlockArray: BacklinkParentBlock[] = await sql(getParentBlockArraySql);
    parentBlockArray = parentBlockArray ? parentBlockArray : [];

    let backlinkParentBlockIdSet: Set<string> = new Set<string>;
    for (const parentBlock of parentBlockArray) {
        if (parentBlock.type == 'i') {
            let count = countOccurrences(parentBlock.childIdPath, "->");
            if (count > 2) {
                backlinkParentBlockIdSet.add(parentBlock.id);
            }
        }
    }
    if (isSetNotEmpty(backlinkParentBlockIdSet)) {
        relatedBlockQueryCriteria.backlinkParentBlockIds = Array.from(backlinkParentBlockIdSet);
        let getSubMarkdownSql = generateGetParenListItemtDefBlockArraySql(relatedBlockQueryCriteria);
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
    param: {
        curDocDefBlockArray: DefBlock[],
        backlinkBlockArray: BacklinkBlock[],
        backlinkChildBlockArray: BacklinkChildBlock[],
        backlinkParentBlockArray: BacklinkParentBlock[],
    }
): Promise<BacklinkPanelData> {
    let defBlockIdArray = getBlockIds(param.curDocDefBlockArray);

    // 创建一个id到节点的映射
    const backlinkBlockMap: { [key: string]: BacklinkBlockNode } = {};
    let relatedDefBlockCountMap = new Map<string, number>();
    let relatedDocumentCountMap = new Map<string, number>();
    let relatedDefBlockAnchorMap = new Map<string, Set<string>>();
    // 整个活，把关联的块的时间修改为反链块的时间。 map 的键是关联块的id
    let backlinkBlockCreatedMap = new Map<string, string>();
    let backlinkBlockUpdatedMap = new Map<string, string>();

    for (const backlinkBlock of param.backlinkBlockArray) {
        let backlinkBlockNode: BacklinkBlockNode = { block: { ...backlinkBlock, refCount: null }, concatContent: "", includeDirectDefBlockIds: new Set<string>(), includeRelatedDefBlockIds: new Set<string>() };
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
                backlinkBlockCreatedMap.set(relatedDefBlockId, backlinkBlock.created);
                backlinkBlockUpdatedMap.set(relatedDefBlockId, backlinkBlock.updated);
                updateMapCount(relatedDefBlockCountMap, relatedDefBlockId);
            }
        }
        backlinkBlockNode.concatContent += content;
        backlinkBlockCreatedMap.set(backlinkBlock.root_id, backlinkBlock.created);
        backlinkBlockUpdatedMap.set(backlinkBlock.root_id, backlinkBlock.updated);
        updateMapCount(relatedDocumentCountMap, backlinkBlock.root_id);
        updateAnchorMap(relatedDefBlockAnchorMap, markdown);
        backlinkBlockMap[backlinkBlockNode.block.id] = backlinkBlockNode;
    }
    // 这里必须再生成一个关联块ID Set，用来区分下面父级关联块 markdown 中存在该关联块，防止set里的关联块重新计数
    let relatedDefBlockIdSet = new Set(relatedDefBlockCountMap.keys());

    for (const childBlock of param.backlinkChildBlockArray) {
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
            updateAnchorMap(relatedDefBlockAnchorMap, markdown);
        }
    }


    for (const parentBlock of param.backlinkParentBlockArray) {
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
            updateAnchorMap(relatedDefBlockAnchorMap, markdown);
            // updateMapCount(relatedDocumentCountMap, parentBlock.root_id);
        }
    }

    const combinedKeys = [...relatedDefBlockCountMap.keys(), ...relatedDocumentCountMap.keys()];

    let relatedDefBlockAndDocumentMap = await getBlockInfoMap(combinedKeys);

    let relatedDefBlockArray: DefBlock[] = [];
    let relatedDocumentArray: DefBlock[] = [];

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
            let anchor = "";
            let anchorSet = relatedDefBlockAnchorMap.get(blockInfo.id);
            if (anchorSet) {
                anchor = Array.from(anchorSet).join(' ');
            }
            refBlockInfo.anchor = anchor;
        }
    }

    for (const key of relatedDocumentCountMap.keys()) {
        let blockCount = relatedDocumentCountMap.get(key);
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
            refBlockInfo.updated = updated ? created : refBlockInfo.updated;
            relatedDocumentArray.push(refBlockInfo);
        }
    }

    let rootId = param.curDocDefBlockArray[0].root_id;
    let backlinkBlockNodeArray: BacklinkBlockNode[] = Object.values(backlinkBlockMap);

    let backlinkPanelData: BacklinkPanelData = {
        rootId,
        backlinkBlockNodeArray,
        curDocDefBlockArray: param.curDocDefBlockArray,
        relatedDefBlockArray,
        relatedDocumentArray,
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


function getRootBlockIdArray(blockTreeNodeArray: BacklinkBlockNode[]) {
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
    backlinkBlockArray: BacklinkBlockNode[],
    blockSortMethod: BlockSortMethod,
) {
    if (!backlinkBlockArray || backlinkBlockArray.length <= 0) {
        return;
    }

    let blockSortFun: (
        a: DefBlock,
        b: DefBlock,
    ) => number = getDefBlockSortFun(blockSortMethod);
    if (blockSortFun) {
        const backlinkBlockNodeSortFun = (a: BacklinkBlockNode, b: BacklinkBlockNode): number => {
            return blockSortFun(a.block, b.block);
        };

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

export async function defBlockArrayKeywordMatch(
    defBlockArray: DefBlock[],
    keywordStr: string,
) {
    if (isArrayEmpty(defBlockArray)) {
        return;
    }

    // 分离空格
    let keywordArray = keywordStr.trim().replace(/\s+/g, " ").split(" ");
    if (isArrayEmpty(keywordArray)) {
        for (const defBlock of defBlockArray) {
            defBlock.filterStatus = false;
        }
        return;
    }
    // 去重
    keywordArray = Array.from(new Set(
        keywordArray.filter((keyword) => keyword.length > 0),
    ));
    for (const defBlock of defBlockArray) {
        let anchor = defBlock.anchor ? defBlock.anchor + "-anchor- -静态连接- -锚-" : "";
        let blockContent = defBlock.content + defBlock.name + defBlock.alias + defBlock.memo + anchor;
        let containsAll = containsAllKeywords(blockContent, keywordArray);
        if (containsAll) {
            defBlock.filterStatus = false;
        } else {
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

function updateMapCount(map: Map<string, number>, key: string, initialValue = 1) {
    let refCount = map.get(key);
    refCount = refCount ? refCount + 1 : initialValue;
    map.set(key, refCount);
}

function updateAnchorMap(map: Map<string, Set<string>>, markdown: string) {
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