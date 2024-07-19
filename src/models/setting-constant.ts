import { BACKLINK_BLOCK_SORT_METHOD_ELEMENT, CUR_DOC_DEF_BLOCK_SORT_METHOD_ELEMENT, RELATED_DEF_BLOCK_SORT_METHOD_ELEMENT, RELATED_DOCMUMENT_SORT_METHOD_ELEMENT } from "./backlink-constant";
import { ItemProperty, IOption, TabProperty } from "./setting-model";

export function getSettingTabArray(): TabProperty[] {

    let tabProperties: TabProperty[] = [

    ];

    tabProperties.push(
        new TabProperty({
            key: "panel-setting", name: "反链面板", iconKey: "iconOrderedList", props: [
                new ItemProperty({ key: "queryParentDefBlock", type: "switch", name: "查询父级定义块", description: "", tips: "" }),
                new ItemProperty({ key: "querrChildDefBlockForListItem", type: "switch", name: "查询列表项下定义块", description: "如果反链块的父级是列表项快，则查询该列表项块底下的所有关联定义块", tips: "" }),
                new ItemProperty({ key: "queryChildDefBlockForHeadline", type: "switch", name: "查询标题下定义块", description: "如果反链块是标题块，则查询标题下的所有关联定义块", tips: "" }),
                // new ConfigProperty({ key: "usePraentIdIdx", type: "switch", name: "使用索引", description: "", tips: "" }),


                new ItemProperty({ key: "pageSize", type: "number", name: "页数", description: "每页反链块显示的数量", tips: "", min: 1, max: 50 }),
                new ItemProperty({ key: "backlinkBlockSortMethod", type: "select", name: "反链块排序方式", description: "", tips: "", options: getBacklinkBlockSortMethodOptions() }),
                new ItemProperty({ key: "filterPanelCurDocDefBlockSortMethod", type: "select", name: "当前文档定义块排序方式", description: "", tips: "", options: geturDocDefBlockSortMethodElement() }),
                new ItemProperty({ key: "filterPanelRelatedDefBlockSortMethod", type: "select", name: "关联定义块排序方式", description: "", tips: "", options: getRelatedDefBlockSortMethodElement() }),
                new ItemProperty({ key: "filterPanelRelatedDocumentSortMethod", type: "select", name: "关联文档排序方式", description: "", tips: "", options: getRelatedDocmumentSortMethodElement() }),
            ]

        }),
        new TabProperty({
            key: "plugin-setting", name: "插件设置", iconKey: "iconTags", props: [
                // new ItemProperty({ key: "dockDisplay", type: "switch", name: "显示反链面板 Dock", description: "", tips: "" }),
                // new ItemProperty({ key: "documentBottomDisplay", type: "switch", name: "文档底部显示反链面板", description: "", tips: "" }),
                // new ItemProperty({ key: "topBarDisplan", type: "switch", name: "桌面端顶栏创建反链页签 Icon", description: "", tips: "" }),
                new ItemProperty({ key: "cacheAfterResponseMs", type: "number", name: "启用缓存门槛（毫秒）", description: "当接口响应时间超过这个数，就会把这次查询结果存入缓存，-1 不开启缓存", tips: "", min: -1 }),
                new ItemProperty({ key: "cacheExpirationTime", type: "number", name: "缓存过期时间（秒）", description: "", tips: "缓存数据失效时间", min: -1, }),
            ]
        }),
    );

    return tabProperties;
}

function getBacklinkBlockSortMethodOptions(): IOption[] {
    let backlinkBlockSortMethodElements = BACKLINK_BLOCK_SORT_METHOD_ELEMENT();
    let options: IOption[] = [];
    for (const element of backlinkBlockSortMethodElements) {
        options.push(element);
    }

    return options;
}


function geturDocDefBlockSortMethodElement(): IOption[] {
    let backlinkBlockSortMethodElements = CUR_DOC_DEF_BLOCK_SORT_METHOD_ELEMENT();
    let options: IOption[] = [];
    for (const element of backlinkBlockSortMethodElements) {
        options.push(element);
    }

    return options;
}

function getRelatedDefBlockSortMethodElement(): IOption[] {
    let backlinkBlockSortMethodElements = RELATED_DEF_BLOCK_SORT_METHOD_ELEMENT();
    let options: IOption[] = [];
    for (const element of backlinkBlockSortMethodElements) {
        options.push(element);
    }

    return options;
}

function getRelatedDocmumentSortMethodElement(): IOption[] {
    let backlinkBlockSortMethodElements = RELATED_DOCMUMENT_SORT_METHOD_ELEMENT();
    let options: IOption[] = [];
    for (const element of backlinkBlockSortMethodElements) {
        options.push(element);
    }

    return options;
}