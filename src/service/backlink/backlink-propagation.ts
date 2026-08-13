import { getChildBlocks, sql } from "@/utils/api";
import {
    generateGetBlockArraySql,
    generateGetDocumentSubtreeBlockArraySql,
    generateGetHeadingSubtreeBlockArraySql,
} from "./backlink-sql";
import { isArrayEmpty, isArrayNotEmpty } from "@/utils/array-util";
import { isStrBlank } from "@/utils/string-util";
import { isKernelVersionAtLeast } from "@/utils/siyuan-util";

/**
 * 传递型反链（文档 / 标题），跟进思源 3.8（siyuan#10990，内核 kernel/model/backlink_parent.go）。
 *
 * 内核规则：
 * 1. 文档下首个块是「仅含块引用的段落」→ 反链单位是整篇文档，文档内其它引用全部并入这一条。
 * 2. 标题下首个块是「仅含块引用的段落」→ 反链单位是该标题及其下属全部内容。
 * 3. 段落里还有正文、图片、标签等 → 不传递。
 * 4. 文档已按规则 1 传递 → 文内标题不再按规则 2 传递；标题之间取覆盖范围更大的那个。
 *
 * 插件必须自己算一遍：内核 getBacklinkDoc 返回的渲染 DOM 根节点已经变成文档块 / 标题块，
 * 被并入的那些引用不再单独返回 DOM，若插件仍按「一个引用块一条反链」统计，
 * 就会出现「计数有、条目没有」的空洞。
 */
export interface IBacklinkPropagationUnit {
    // 反链单位块 id：文档块 id 或标题块 id。
    unitId: string;
    unitType: "d" | "h";
    unitBlock: DefBlock;
    // 触发传递的那个「纯块引用段落」的 id，用作合并时的宿主节点。
    triggerBacklinkBlockId: string;
    // 被并入这一条的反链块 id（含 triggerBacklinkBlockId）。
    coveredBacklinkBlockIds: Set<string>;
    // 单位范围内所有块 id，兼容旧内核按引用块粒度返回 DOM 时的归位。
    coveredBlockIds: Set<string>;
    // 单位范围内的全部 markdown + 内部属性，用于扩大关键字与关联定义块的查询范围。
    scopeMarkdown: string;
}

// 文档 / 标题传递由 3.8.0 内核引入。旧内核仍按引用块粒度返回渲染 DOM，
// 这里跟着合并只会让被并入的引用无处显示，所以低版本直接不启用。
const PROPAGATION_MIN_KERNEL_VERSION = "3.8.0";

// 容器块的 markdown 是其子块的拼接，纳入范围会造成大量重复文本。
const CONTAINER_BLOCK_TYPES = new Set(["d", "l", "i", "b", "s"]);

const BLOCK_REF_MARKDOWN_REGEX = /\(\((\d{14}-\w{7})\s(?:'[^']*'|"[^"]*")\)\)/g;

/**
 * 对齐内核 isPureBlockRefParagraph：段落里除了块引用只剩空白才算「纯块引用」。
 * 正文、图片、标签、行级代码等都会留下非空白字符，从而被排除。
 */
export function isPureBlockRefMarkdown(markdown: string): boolean {
    if (isStrBlank(markdown)) {
        return false;
    }
    let hasBlockRef = false;
    let rest = markdown.replace(BLOCK_REF_MARKDOWN_REGEX, () => {
        hasBlockRef = true;
        return " ";
    });
    if (!hasBlockRef) {
        return false;
    }
    // 零宽字符在思源内容里很常见，等同空白处理。
    rest = rest.replace(/[\s\u200b\u200c\u200d\ufeff]/g, "");
    return rest.length === 0;
}

/**
 * 计算当前这批反链块命中的文档 / 标题传递单元。
 * 没有命中时返回空数组，此时整条管线与旧版本完全一致。
 */
export async function buildBacklinkPropagationUnitArray(
    backlinkBlockArray: BacklinkBlock[],
): Promise<IBacklinkPropagationUnit[]> {
    if (isArrayEmpty(backlinkBlockArray) || !isKernelVersionAtLeast(PROPAGATION_MIN_KERNEL_VERSION)) {
        return [];
    }

    // 候选：父级是文档或标题、且自身是纯块引用段落的反链块。
    // 父级是列表项 / 引述块 / 超级块的仍走内核原有传递，不升级成文档或标题。
    let candidateMap = new Map<string, BacklinkBlock[]>();
    for (const backlinkBlock of backlinkBlockArray) {
        if (!backlinkBlock || backlinkBlock.type != "p") {
            continue;
        }
        let parentType = backlinkBlock.parentBlockType;
        if (parentType != "d" && parentType != "h") {
            continue;
        }
        if (!isPureBlockRefMarkdown(backlinkBlock.markdown)) {
            continue;
        }
        let candidateArray = candidateMap.get(backlinkBlock.parent_id);
        if (!candidateArray) {
            candidateArray = [];
            candidateMap.set(backlinkBlock.parent_id, candidateArray);
        }
        candidateArray.push(backlinkBlock);
    }
    if (candidateMap.size <= 0) {
        return [];
    }

    // 「首个段落」判定：getChildBlocks 按文档顺序返回子块，
    // 文档取全部顶层块的第一个，标题取 HeadingChildren 的第一个，与内核 isFirstBacklinkParentParagraph 等价。
    let parentIdArray = Array.from(candidateMap.keys());
    let firstChildIdArray = await Promise.all(parentIdArray.map((parentId) => getFirstChildBlockId(parentId)));

    let acceptedMap = new Map<string, BacklinkBlock>();
    for (const [index, parentId] of parentIdArray.entries()) {
        let firstChildId = firstChildIdArray[index];
        if (isStrBlank(firstChildId)) {
            continue;
        }
        let trigger = candidateMap.get(parentId).find((block) => block.id == firstChildId);
        if (trigger) {
            acceptedMap.set(parentId, trigger);
        }
    }
    if (acceptedMap.size <= 0) {
        return [];
    }

    let unitBlockMap = await getBlockMap(Array.from(acceptedMap.keys()));

    let documentUnitArray: IBacklinkPropagationUnit[] = [];
    let headingParentIdArray: string[] = [];
    for (const [parentId, trigger] of acceptedMap) {
        let unitBlock = unitBlockMap.get(parentId);
        if (!unitBlock) {
            continue;
        }
        if (unitBlock.type == "d") {
            documentUnitArray.push({
                unitId: parentId,
                unitType: "d",
                unitBlock,
                triggerBacklinkBlockId: trigger.id,
                coveredBacklinkBlockIds: new Set<string>(),
                coveredBlockIds: new Set<string>(),
                scopeMarkdown: "",
            });
        } else if (unitBlock.type == "h") {
            headingParentIdArray.push(parentId);
        }
    }

    let propagatedRootIdSet = new Set<string>(documentUnitArray.map((unit) => unit.unitId));
    // 规则 4：文档已经整体传递了，文内标题不再单独传递。
    headingParentIdArray = headingParentIdArray.filter(
        (headingId) => !propagatedRootIdSet.has(unitBlockMap.get(headingId).root_id),
    );
    if (isArrayEmpty(documentUnitArray) && isArrayEmpty(headingParentIdArray)) {
        return [];
    }

    let [documentScopeMap, headingScopeMap] = await Promise.all([
        getDocumentScopeMap(Array.from(propagatedRootIdSet)),
        getHeadingScopeMap(headingParentIdArray),
    ]);

    for (const unit of documentUnitArray) {
        let scope = documentScopeMap.get(unit.unitId);
        if (scope) {
            unit.coveredBlockIds = scope.blockIds;
            unit.scopeMarkdown = scope.markdown;
        }
        for (const backlinkBlock of backlinkBlockArray) {
            if (backlinkBlock && backlinkBlock.root_id == unit.unitId) {
                unit.coveredBacklinkBlockIds.add(backlinkBlock.id);
            }
        }
    }

    let headingUnitArray: IBacklinkPropagationUnit[] = [];
    for (const headingId of headingParentIdArray) {
        let unitBlock = unitBlockMap.get(headingId);
        let scope = headingScopeMap.get(headingId);
        let coveredBlockIds = scope ? scope.blockIds : new Set<string>();
        coveredBlockIds.add(headingId);
        let coveredBacklinkBlockIds = new Set<string>();
        for (const backlinkBlock of backlinkBlockArray) {
            if (backlinkBlock && coveredBlockIds.has(backlinkBlock.id)) {
                coveredBacklinkBlockIds.add(backlinkBlock.id);
            }
        }
        headingUnitArray.push({
            unitId: headingId,
            unitType: "h",
            unitBlock,
            triggerBacklinkBlockId: acceptedMap.get(headingId).id,
            coveredBacklinkBlockIds,
            coveredBlockIds,
            scopeMarkdown: (scope ? scope.markdown : "") + getBlockScopeStr(unitBlock.markdown, unitBlock.name, unitBlock.alias, unitBlock.memo, unitBlock.tag),
        });
    }

    // 规则 4：标题嵌套时优先保留覆盖范围更大的那个，被它覆盖的下级标题不再单独成条。
    headingUnitArray.sort((a, b) => b.coveredBlockIds.size - a.coveredBlockIds.size);
    let acceptedHeadingCoveredIdSet = new Set<string>();
    let acceptedHeadingUnitArray: IBacklinkPropagationUnit[] = [];
    for (const unit of headingUnitArray) {
        if (acceptedHeadingCoveredIdSet.has(unit.unitId)) {
            continue;
        }
        acceptedHeadingUnitArray.push(unit);
        unit.coveredBlockIds.forEach((blockId) => acceptedHeadingCoveredIdSet.add(blockId));
    }

    return [...documentUnitArray, ...acceptedHeadingUnitArray];
}


async function getFirstChildBlockId(parentId: string): Promise<string> {
    try {
        let childBlockArray: IResGetChildBlock[] = await getChildBlocks(parentId);
        if (isArrayEmpty(childBlockArray)) {
            return "";
        }
        return childBlockArray[0].id;
    } catch (err) {
        console.error("反链过滤面板插件 查询子块顺序失败，跳过该块的传递型反链判定 : ", err);
        return "";
    }
}

async function getBlockMap(blockIds: string[]): Promise<Map<string, DefBlock>> {
    let blockMap = new Map<string, DefBlock>();
    if (isArrayEmpty(blockIds)) {
        return blockMap;
    }
    let blockArray: DefBlock[] = await sql(generateGetBlockArraySql(blockIds));
    if (isArrayNotEmpty(blockArray)) {
        for (const block of blockArray) {
            blockMap.set(block.id, block);
        }
    }
    return blockMap;
}

interface IPropagationScope {
    blockIds: Set<string>;
    markdown: string;
}

async function getDocumentScopeMap(rootIds: string[]): Promise<Map<string, IPropagationScope>> {
    return getScopeMap(generateGetDocumentSubtreeBlockArraySql(rootIds), (row) => row.root_id);
}

async function getHeadingScopeMap(headingIds: string[]): Promise<Map<string, IPropagationScope>> {
    return getScopeMap(generateGetHeadingSubtreeBlockArraySql(headingIds), (row) => row.headingId);
}

async function getScopeMap(
    scopeSql: string,
    getScopeKey: (row: any) => string,
): Promise<Map<string, IPropagationScope>> {
    let scopeMap = new Map<string, IPropagationScope>();
    if (isStrBlank(scopeSql)) {
        return scopeMap;
    }
    let rowArray: any[] = await sql(scopeSql);
    if (isArrayEmpty(rowArray)) {
        return scopeMap;
    }
    for (const row of rowArray) {
        let scopeKey = getScopeKey(row);
        if (isStrBlank(scopeKey)) {
            continue;
        }
        let scope = scopeMap.get(scopeKey);
        if (!scope) {
            scope = { blockIds: new Set<string>(), markdown: "" };
            scopeMap.set(scopeKey, scope);
        }
        scope.blockIds.add(row.id);
        // 容器块的 markdown 会重复其子块内容，只取内部属性。
        let rowMarkdown = CONTAINER_BLOCK_TYPES.has(row.type) ? "" : row.markdown;
        scope.markdown += getBlockScopeStr(rowMarkdown, row.inAttrConcat);
    }
    return scopeMap;
}

function getBlockScopeStr(...parts: string[]): string {
    let result = "";
    for (const part of parts) {
        if (isStrBlank(part)) {
            continue;
        }
        result += part + " ";
    }
    return result;
}
