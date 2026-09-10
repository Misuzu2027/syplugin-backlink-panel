import { EnvConfig } from "@/config/EnvConfig";
import { IBacklinkBlockNode } from "@/models/backlink-model";
import { getAttributeViewKeys, getMirrorDatabaseBlocks } from "@/utils/api";
import { isArrayEmpty, isArrayNotEmpty } from "@/utils/array-util";
import { convertIconInIal } from "@/utils/icon-util";
import { isStrBlank, isStrNotBlank } from "@/utils/string-util";
import { openTab, Protyle } from "siyuan";

interface IAvItemPreview {
    itemID: string;
    valueID: string;
    title: string;
    keyIDs: Set<string>;
    valueIDs: Set<string>;
}

/**
 * 数据库文本单元格反链：不渲染当前视图里的整张表（会被过滤/分组挡住），
 * 按命中条目各出一张字段预览，数据来自条目本身。
 */
export async function replaceAttributeViewTablesWithItemPreviews(
    backlinkData: IBacklinkData,
    protyle: Protyle,
): Promise<string> {
    let contentElement = protyle?.protyle?.contentElement as HTMLElement;
    if (!contentElement) {
        return "";
    }
    hideBacklinkBreadcrumb(contentElement);
    hideAttributeViewTables(contentElement);
    let preview = backlinkData?.avItemPreview;
    let targets = backlinkData?.attributeViewTargets;
    if (!preview && isArrayEmpty(targets)) {
        return "";
    }
    let renderedTitle = "";
    if (preview && isStrNotBlank(preview.avID) && isStrNotBlank(preview.itemID)) {
        renderedTitle = await mountAttributeViewItemCard(contentElement, preview);
        return renderedTitle;
    }
    if (isArrayEmpty(targets)) {
        return "";
    }
    for (const target of targets) {
        if (!target || isStrBlank(target.blockID) || isArrayEmpty(target.matches)) {
            continue;
        }
        let avID = getAvIdFromTarget(contentElement, backlinkData.dom, target.blockID);
        if (isStrBlank(avID)) {
            continue;
        }
        let items = groupAttributeViewMatches(target.matches);
        if (isArrayEmpty(items)) {
            continue;
        }
        for (const item of items) {
            let title = await mountAttributeViewItemCard(contentElement, {
                avID,
                itemID: item.itemID,
                valueID: item.valueID,
                title: item.title,
                keyIDs: Array.from(item.keyIDs),
                valueIDs: Array.from(item.valueIDs),
                databaseBlockID: target.blockID,
                notebookId: backlinkData.backlinkBlock?.box || "",
            });
            if (isStrNotBlank(title) && isStrBlank(renderedTitle)) {
                renderedTitle = title;
            }
        }
    }
    return renderedTitle;
}

/**
 * 同一数据库条目的多个镜像合成一条；同一数据库块里的多个命中条目拆成多条。
 */
export function mergeAttributeViewMirrorBacklinks(backlinks: IBacklinkData[]): IBacklinkData[] {
    if (isArrayEmpty(backlinks)) {
        return backlinks || [];
    }
    let result: IBacklinkData[] = [];
    let itemMap = new Map<string, IBacklinkData>();
    for (const backlink of backlinks) {
        let items = collectAttributeViewItemPreviews(backlink);
        if (isArrayEmpty(items)) {
            result.push(backlink);
            continue;
        }
        for (const item of items) {
            let key = `${item.avID}:${item.itemID}`;
            let existing = itemMap.get(key);
            let itemMatches = collectMatchesForItem(backlink, item.itemID);
            if (existing?.avItemPreview) {
                mergeAttributeViewItemPreview(existing.avItemPreview, item);
                appendUniqueMatches(existing, itemMatches);
                continue;
            }
            let clone: IBacklinkData = {
                ...backlink,
                blockPaths: [],
                attributeViewTargets: [{
                    blockID: item.databaseBlockID,
                    matches: itemMatches,
                }],
                avItemPreview: { ...item, keyIDs: [...item.keyIDs], valueIDs: [...item.valueIDs] },
            };
            itemMap.set(key, clone);
            result.push(clone);
        }
    }
    return result;
}

export async function collapseMirrorAvBacklinkNodes(
    nodes: IBacklinkBlockNode[],
    backlinks: IBacklinkData[],
): Promise<IBacklinkBlockNode[]> {
    if (isArrayEmpty(nodes)) {
        return nodes || [];
    }
    let avIDs = [...new Set(
        (backlinks || [])
            .map((item) => item?.avItemPreview?.avID)
            .filter((id) => isStrNotBlank(id)),
    )];
    if (isArrayEmpty(avIDs)) {
        return nodes;
    }
    let removeIds = new Set<string>();
    for (const avID of avIDs) {
        let mirrorIds: string[] = [];
        try {
            mirrorIds = await getMirrorDatabaseBlocks(avID);
        } catch (error) {
            console.log("反链面板插件 获取数据库镜像失败", avID, error);
        }
        if (isArrayEmpty(mirrorIds)) {
            continue;
        }
        let mirrorSet = new Set(mirrorIds);
        let kept = false;
        for (const node of nodes) {
            let blockId = node?.block?.id;
            if (!blockId || !mirrorSet.has(blockId)) {
                continue;
            }
            if (!kept) {
                kept = true;
                continue;
            }
            removeIds.add(blockId);
        }
    }
    if (removeIds.size === 0) {
        return nodes;
    }
    return nodes.filter((node) => !removeIds.has(node?.block?.id));
}

export function openAttributeViewItemTab(preview: IBacklinkAVItemPreview): boolean {
    if (!preview || isStrBlank(preview.avID) || isStrBlank(preview.itemID) || isStrBlank(preview.databaseBlockID) || EnvConfig.ins.isMobile) {
        return false;
    }
    let title = preview.title || window.siyuan?.languages?.untitled || "";
    openTab({
        app: EnvConfig.ins.app,
        custom: {
            id: "siyuan-database-row",
            icon: "iconDatabase",
            title,
            data: {
                avID: preview.avID,
                blockID: preview.databaseBlockID,
                notebookId: preview.notebookId,
                itemID: preview.itemID,
                valueID: preview.valueID,
                title,
            },
        },
    });
    return true;
}

export function getAttributeViewItemPreviewFromElement(element: HTMLElement): IBacklinkAVItemPreview {
    if (!element) {
        return null;
    }
    let avID = element.getAttribute("data-av-id");
    let itemID = element.getAttribute("data-item-id");
    if (isStrBlank(avID) || isStrBlank(itemID)) {
        return null;
    }
    return {
        avID,
        itemID,
        valueID: element.getAttribute("data-value-id") || "",
        title: element.querySelector(".b3-list-item__text")?.textContent || "",
        keyIDs: [],
        valueIDs: [],
        databaseBlockID: element.getAttribute("data-av-block-id") || "",
        notebookId: element.getAttribute("data-notebook-id") || "",
    };
}

function hideAttributeViewTables(contentElement: HTMLElement) {
    if (!contentElement) {
        return;
    }
    contentElement.querySelectorAll('[data-type="NodeAttributeView"]').forEach((element) => {
        element.classList.add("fn__none");
        element.setAttribute("data-backlink-av-table-hidden", "true");
    });
}

async function mountAttributeViewItemCard(
    contentElement: HTMLElement,
    preview: IBacklinkAVItemPreview,
): Promise<string> {
    let avElement = findAttributeViewElement(contentElement, preview.databaseBlockID);
    let host = contentElement.querySelector(
        `.backlink-panel__av-items[data-av-block-id="${preview.databaseBlockID}"]`,
    ) as HTMLElement;
    if (!host) {
        host = document.createElement("div");
        host.className = "backlink-panel__av-items";
        host.setAttribute("data-av-block-id", preview.databaseBlockID);
        if (avElement) {
            avElement.classList.add("fn__none");
            avElement.setAttribute("data-backlink-av-table-hidden", "true");
            avElement.after(host);
        } else {
            contentElement.querySelector(".protyle-wysiwyg")?.append(host);
        }
    } else if (avElement) {
        avElement.classList.add("fn__none");
        avElement.setAttribute("data-backlink-av-table-hidden", "true");
    }
    let card = document.createElement("div");
    card.className = "custom-attr protyle-db-row__body backlink-panel__av-item";
    card.setAttribute("contenteditable", "false");
    host.append(card);
    return renderAttributeViewItemCard(card, preview);
}

function findAttributeViewElement(contentElement: HTMLElement, blockID: string): HTMLElement {
    if (!contentElement || isStrBlank(blockID)) {
        return null;
    }
    let avElement = contentElement.querySelector(
        `[data-node-id="${blockID}"][data-type="NodeAttributeView"]`,
    ) as HTMLElement;
    if (!avElement) {
        avElement = contentElement.querySelector(
            `[data-node-id="${blockID}"]`,
        ) as HTMLElement;
    }
    return avElement;
}

function hideBacklinkBreadcrumb(contentElement: HTMLElement) {
    if (!contentElement) {
        return;
    }
    contentElement.querySelectorAll(".protyle-breadcrumb__bar").forEach((element) => {
        element.classList.add("fn__none");
    });
}

function getAvIdFromTarget(contentElement: HTMLElement, dom: string, blockID: string): string {
    let avElement = findAttributeViewElement(contentElement, blockID);
    return avElement?.getAttribute("data-av-id") || getAvIdFromDom(dom, blockID);
}

function collectAttributeViewItemPreviews(backlink: IBacklinkData): IBacklinkAVItemPreview[] {
    if (backlink?.avItemPreview && isStrNotBlank(backlink.avItemPreview.avID) && isStrNotBlank(backlink.avItemPreview.itemID)) {
        return [backlink.avItemPreview];
    }
    let targets = backlink?.attributeViewTargets;
    if (isArrayEmpty(targets)) {
        return [];
    }
    let result: IBacklinkAVItemPreview[] = [];
    let seen = new Set<string>();
    for (const target of targets) {
        if (!target || isStrBlank(target.blockID) || isArrayEmpty(target.matches)) {
            continue;
        }
        let avID = getAvIdFromDom(backlink.dom, target.blockID);
        if (isStrBlank(avID)) {
            continue;
        }
        for (const item of groupAttributeViewMatches(target.matches)) {
            let key = `${avID}:${item.itemID}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            result.push({
                avID,
                itemID: item.itemID,
                valueID: item.valueID,
                title: item.title,
                keyIDs: Array.from(item.keyIDs),
                valueIDs: Array.from(item.valueIDs),
                databaseBlockID: target.blockID,
                notebookId: backlink.backlinkBlock?.box || "",
            });
        }
    }
    return result;
}

function collectMatchesForItem(backlink: IBacklinkData, itemID: string): IBacklinkAVMatch[] {
    let matches: IBacklinkAVMatch[] = [];
    for (const target of backlink?.attributeViewTargets || []) {
        for (const match of target?.matches || []) {
            if (match?.itemID === itemID) {
                matches.push(match);
            }
        }
    }
    return matches;
}

function mergeAttributeViewItemPreview(target: IBacklinkAVItemPreview, source: IBacklinkAVItemPreview) {
    if (isStrBlank(target.title) && isStrNotBlank(source.title)) {
        target.title = source.title;
    }
    if (isStrBlank(target.valueID) && isStrNotBlank(source.valueID)) {
        target.valueID = source.valueID;
    }
    target.keyIDs = uniqueStrings([...(target.keyIDs || []), ...(source.keyIDs || [])]);
    target.valueIDs = uniqueStrings([...(target.valueIDs || []), ...(source.valueIDs || [])]);
}

function appendUniqueMatches(backlink: IBacklinkData, matches: IBacklinkAVMatch[]) {
    if (isArrayEmpty(matches)) {
        return;
    }
    if (!backlink.attributeViewTargets) {
        backlink.attributeViewTargets = [];
    }
    let target = backlink.attributeViewTargets[0];
    if (!target) {
        backlink.attributeViewTargets.push({
            blockID: backlink.avItemPreview?.databaseBlockID || "",
            matches: [...matches],
        });
        return;
    }
    if (!target.matches) {
        target.matches = [];
    }
    let exist = new Set(target.matches.map((match) => `${match?.itemID}:${match?.keyID}:${match?.valueID}`));
    for (const match of matches) {
        let key = `${match?.itemID}:${match?.keyID}:${match?.valueID}`;
        if (exist.has(key)) {
            continue;
        }
        exist.add(key);
        target.matches.push(match);
    }
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set((values || []).filter((item) => isStrNotBlank(item)))];
}

function groupAttributeViewMatches(matches: IBacklinkAVMatch[]): IAvItemPreview[] {
    let itemMap = new Map<string, IAvItemPreview>();
    for (const match of matches) {
        if (!match || isStrBlank(match.itemID)) {
            continue;
        }
        let item = itemMap.get(match.itemID);
        if (!item) {
            item = {
                itemID: match.itemID,
                valueID: match.valueID,
                title: match.title,
                keyIDs: new Set<string>(),
                valueIDs: new Set<string>(),
            };
            itemMap.set(match.itemID, item);
        }
        if (isStrNotBlank(match.keyID)) {
            item.keyIDs.add(match.keyID);
        }
        if (isStrNotBlank(match.valueID)) {
            item.valueIDs.add(match.valueID);
        }
    }
    return Array.from(itemMap.values());
}

function getAvIdFromDom(dom: string, blockID: string): string {
    if (isStrBlank(dom) || isStrBlank(blockID)) {
        return "";
    }
    let byNode = new RegExp(`data-node-id="${blockID}"[^>]*data-av-id="([^"]+)"`);
    let byAv = new RegExp(`data-av-id="([^"]+)"[^>]*data-node-id="${blockID}"`);
    let match = dom.match(byNode) || dom.match(byAv);
    if (match) {
        return match[1];
    }
    try {
        let root = document.createElement("div");
        root.innerHTML = dom;
        let node = root.querySelector(`[data-node-id="${blockID}"]`);
        return node?.getAttribute("data-av-id") || root.querySelector("[data-av-id]")?.getAttribute("data-av-id") || "";
    } catch {
        return "";
    }
}

async function renderAttributeViewItemCard(
    card: HTMLElement,
    preview: IBacklinkAVItemPreview,
): Promise<string> {
    let tables = await getAttributeViewKeys({
        id: preview.itemID,
        avID: preview.avID,
        itemID: preview.itemID,
        valueID: preview.valueID,
    });
    let title = preview.title || "";
    if (isArrayEmpty(tables)) {
        card.innerHTML = `<div class="ft__on-surface" style="padding:8px 16px;">${escapeHtml(title)}</div>`;
        return title;
    }
    let html = "";
    let hit = {
        keyIDs: new Set(preview.keyIDs || []),
        valueIDs: new Set(preview.valueIDs || []),
        itemID: preview.itemID,
    };
    for (const table of tables) {
        if (!table) {
            continue;
        }
        let rowsHtml = "";
        if (isArrayNotEmpty(table.keyValues)) {
            for (const keyValue of table.keyValues) {
                if (keyValue?.key?.type === "block") {
                    let blockTitle = keyValue.values?.[0]?.block?.content;
                    if (isStrNotBlank(blockTitle)) {
                        title = blockTitle;
                    }
                }
                rowsHtml += renderAttributeViewItemRow(table.avID, keyValue, hit);
            }
        }
        html += `<div data-av-id="${escapeAttr(table.avID)}">
    ${rowsHtml}
</div>`;
    }
    card.innerHTML = html;
    return title;
}

function renderAttributeViewItemRow(
    avID: string,
    keyValue: IAttributeViewItemKeyValue,
    item: { keyIDs: Set<string>, valueIDs: Set<string>, itemID: string },
): string {
    let key = keyValue?.key;
    if (!key) {
        return "";
    }
    let value = keyValue.values && keyValue.values[0] ? keyValue.values[0] : { type: key.type, keyID: key.id };
    let empty = isAttributeViewValueEmpty(value);
    let hit = item.keyIDs.has(key.id) || (value.id && item.valueIDs.has(value.id));
    let iconHtml = renderFieldIcon(key.icon, key.type);
    let valueHtml = renderAttributeViewValue(value);
    let hitClass = hit ? " backlink-panel__av-row--hit" : "";
    return `<div class="block__icons av__row${hitClass}" data-col-id="${escapeAttr(key.id)}" data-empty="${empty}"${key.type === "block" ? ' data-primary="true"' : ""}>
    <div class="block__logo block__logo--icon">
        ${iconHtml}
        <span>${escapeHtml(key.name || "")}</span>
    </div>
    <div class="fn__flex-1 fn__flex custom-attr__avvalue custom-attr__avvalue--readonly" data-av-id="${escapeAttr(avID)}" data-col-id="${escapeAttr(key.id)}" data-row-id="${escapeAttr(value.blockID || item.itemID)}"${value.id ? ` data-id="${escapeAttr(value.id)}"` : ""} data-type="${escapeAttr(value.type || key.type)}" placeholder="${escapeAttr(window.siyuan?.languages?.empty || "")}">${valueHtml}</div>
</div>`;
}

function renderFieldIcon(icon: string, type: string): string {
    let emoji = convertIconInIal(icon);
    if (emoji) {
        return `<span class="block__logoicon">${emoji}</span>`;
    }
    return `<svg class="block__logoicon"><use xlink:href="#${getAvColIcon(type)}"></use></svg>`;
}

function getAvColIcon(type: string): string {
    switch (type) {
        case "text":
            return "iconAlignLeft";
        case "block":
            return "iconKey";
        case "number":
            return "iconNumber";
        case "select":
            return "iconListItem";
        case "mSelect":
            return "iconList";
        case "relation":
            return "iconOpen";
        case "rollup":
            return "iconSearch";
        case "date":
            return "iconCalendar";
        case "updated":
        case "created":
            return "iconClock";
        case "url":
            return "iconLink";
        case "mAsset":
            return "iconImage";
        case "email":
            return "iconEmail";
        case "phone":
            return "iconPhone";
        case "template":
            return "iconMath";
        case "checkbox":
            return "iconCheck";
        default:
            return "iconAlignLeft";
    }
}

function renderAttributeViewValue(value: IAttributeViewCellValue): string {
    if (!value || !value.type) {
        return "";
    }
    if (isStrNotBlank(value.renderedContent)) {
        return value.renderedContent;
    }
    switch (value.type) {
        case "block":
            return renderBlockCell(value);
        case "text":
            return renderTextCell(value);
        case "number":
            if (value.number?.formattedContent) {
                return escapeHtml(value.number.formattedContent);
            }
            return value.number?.isNotEmpty ? escapeHtml(String(value.number.content)) : "";
        case "select":
        case "mSelect":
            return renderSelectCell(value);
        case "date":
        case "created":
        case "updated":
            return renderDateCell(value);
        case "url":
            return renderLinkCell(value.url?.content, value.url?.content);
        case "email":
            return renderLinkCell(value.email?.content, value.email?.content ? `mailto:${value.email.content}` : "");
        case "phone":
            return renderLinkCell(value.phone?.content, value.phone?.content ? `tel:${value.phone.content}` : "");
        case "checkbox":
            return `<svg class="av__checkbox"><use xlink:href="#icon${value.checkbox?.checked ? "Check" : "Uncheck"}"></use></svg>`;
        case "relation":
            return renderRelationCell(value);
        case "mAsset":
            return renderAssetCell(value);
        case "template":
            return value.template?.content || "";
        case "rollup":
            return (value.rollup?.contents || []).map((item) => renderAttributeViewValue(item)).filter(Boolean).join(", ");
        default:
            return "";
    }
}

function renderBlockCell(value: IAttributeViewCellValue): string {
    let content = value.block?.content || window.siyuan?.languages?.untitled || "";
    if (value.isDetached || isStrBlank(value.block?.id)) {
        return escapeHtml(content);
    }
    return `<span data-type="block-ref" data-id="${escapeAttr(value.block.id)}" data-subtype="d" class="av__celltext av__celltext--ref">${escapeHtml(content)}</span>`;
}

function renderTextCell(value: IAttributeViewCellValue): string {
    let richContent = value.text?.rich?.content;
    if (isStrNotBlank(richContent)) {
        if (richContent.includes("<")) {
            return richContent;
        }
        return renderKramdownRefs(richContent);
    }
    return escapeHtml(value.text?.content || "");
}

function renderKramdownRefs(markdown: string): string {
    let escaped = escapeHtml(markdown);
    return escaped.replace(
        /\(\((\d{14}-\w{7})\s(?:&quot;|&#39;|['"])([^'"]+)(?:&quot;|&#39;|['"])\)\)/g,
        (_all, id, anchor) => `<span data-type="block-ref" data-id="${id}" data-subtype="s" class="av__celltext av__celltext--ref">${anchor}</span>`,
    );
}

function renderSelectCell(value: IAttributeViewCellValue): string {
    let options = value.mSelect || [];
    if (value.type === "select") {
        options = options.slice(0, 1);
    }
    return options.map((item) => {
        let color = item.color || "1";
        return `<span class="b3-chip b3-chip--middle" style="background-color:var(--b3-font-background${color});color:var(--b3-font-color${color})">${escapeHtml(item.content || "")}</span>`;
    }).join("");
}

function renderDateCell(value: IAttributeViewCellValue): string {
    let dataValue = value[value.type as "date" | "created" | "updated"];
    if (!dataValue) {
        return "";
    }
    if (isStrNotBlank(dataValue.formattedContent)) {
        return escapeHtml(dataValue.formattedContent);
    }
    if (!dataValue.isNotEmpty || !dataValue.content) {
        return "";
    }
    let date = new Date(dataValue.content);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, "0");
    let day = String(date.getDate()).padStart(2, "0");
    let text = `${year}-${month}-${day}`;
    if (!dataValue.isNotTime) {
        let hour = String(date.getHours()).padStart(2, "0");
        let minute = String(date.getMinutes()).padStart(2, "0");
        text += ` ${hour}:${minute}`;
    }
    return escapeHtml(text);
}

function renderLinkCell(text: string, href: string): string {
    if (isStrBlank(text)) {
        return "";
    }
    if (isStrBlank(href)) {
        return escapeHtml(text);
    }
    return `<a class="fn__a" href="${escapeAttr(href)}" target="_blank">${escapeHtml(text)}</a>`;
}

function renderRelationCell(value: IAttributeViewCellValue): string {
    let contents = value.relation?.contents || [];
    let blockIDs = value.relation?.blockIDs || [];
    return contents.map((item, index) => {
        let content = item?.block?.content || window.siyuan?.languages?.untitled || "";
        let id = item?.block?.id || blockIDs[index];
        if (item?.isDetached || isStrBlank(id)) {
            return escapeHtml(content);
        }
        return `<span data-type="block-ref" data-id="${escapeAttr(id)}" data-subtype="d" class="av__celltext av__celltext--ref">${escapeHtml(content)}</span>`;
    }).join(", ");
}

function renderAssetCell(value: IAttributeViewCellValue): string {
    return (value.mAsset || []).map((item) => {
        if (item.type === "image") {
            return `<img loading="lazy" class="av__cellassetimg" src="${escapeAttr(item.content || "")}">`;
        }
        return `<span class="b3-chip b3-chip--middle">${escapeHtml(item.name || item.content || "")}</span>`;
    }).join("");
}

function isAttributeViewValueEmpty(value: IAttributeViewCellValue): boolean {
    if (!value) {
        return true;
    }
    if (isStrNotBlank(value.renderedContent)) {
        return false;
    }
    switch (value.type) {
        case "block":
            return isStrBlank(value.block?.content);
        case "text":
            return isStrBlank(value.text?.content) && isStrBlank(value.text?.rich?.content);
        case "number":
            return !value.number?.isNotEmpty;
        case "select":
        case "mSelect":
            return isArrayEmpty(value.mSelect);
        case "date":
        case "created":
        case "updated":
            return !value[value.type]?.isNotEmpty;
        case "url":
            return isStrBlank(value.url?.content);
        case "email":
            return isStrBlank(value.email?.content);
        case "phone":
            return isStrBlank(value.phone?.content);
        case "checkbox":
            return !value.checkbox?.checked;
        case "relation":
            return isArrayEmpty(value.relation?.contents);
        case "mAsset":
            return isArrayEmpty(value.mAsset);
        case "template":
            return isStrBlank(value.template?.content);
        case "rollup":
            return isArrayEmpty(value.rollup?.contents);
        default:
            return true;
    }
}

function escapeHtml(input: string): string {
    if (!input) {
        return "";
    }
    return input.replace(/[&<>"']/g, (match) => {
        switch (match) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            default:
                return "&#39;";
        }
    });
}

function escapeAttr(input: string): string {
    return escapeHtml(input);
}
