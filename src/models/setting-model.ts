import { isValidStr } from "@/utils/string-util";


export class SettingConfig {
    // 筛选面板
    filterPanelViewExpand: boolean;
    queryParentDefBlock: boolean;
    querrChildDefBlockForListItem: boolean;
    queryChildDefBlockForHeadline: boolean;
    filterPanelCurDocDefBlockSortMethod: BlockSortMethod;
    filterPanelRelatedDefBlockSortMethod: BlockSortMethod;
    filterPanelBacklinkDocumentSortMethod: BlockSortMethod;


    // 反链面板
    pageSize: number;
    backlinkBlockSortMethod: BlockSortMethod;
    hideBacklinkProtyleBreadcrumb: boolean;
    defaultExpandedListItemLevel: number;
    // queryAllContentUnderHeadline: boolean;


    // 插件设置
    dockDisplay: Boolean;
    documentBottomDisplay: boolean;
    topBarDisplay: boolean;
    // 缓存
    cacheAfterResponseMs: number;
    cacheExpirationTime: number;
    usePraentIdIdx: boolean;
    // 双击阈值
    doubleClickTimeout: number;

    // 文档底部反链面板宽度
    documentBottomBacklinkPaddingWidth: number
}


interface ITabProperty {
    key: string;
    name: string;
    props: Array<ItemProperty>;
    iconKey?: string;
}


export class TabProperty {
    key: string;
    name: string;
    iconKey: string;
    props: ItemProperty[];

    constructor({ key, name, iconKey, props }: ITabProperty) {
        this.key = key;
        this.name = name;
        if (isValidStr(iconKey)) {
            this.iconKey = iconKey;
        } else {
            this.iconKey = "setting";
        }
        this.props = props;

    }

}

export interface IOption {
    name: string;
    desc?: string;
    value: string;
}




export class ItemProperty {
    key: string;
    type: IItemPropertyType;
    name: string;
    description: string;
    tips?: string;

    min?: number;
    max?: number;
    btndo?: () => void;
    options?: IOption[];


    constructor({ key, type, name, description, tips, min, max, btndo, options }: ItemProperty) {
        this.key = key;
        this.type = type;
        this.min = min;
        this.max = max;
        this.btndo = btndo;
        this.options = options ?? [];
        this.name = name;
        this.description = description;
        this.tips = tips;
    }

}
