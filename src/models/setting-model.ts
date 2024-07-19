import { isValidStr } from "@/utils/string-util";


export class SettingConfig {
    // 查询范围
    queryParentDefBlock: boolean;
    querrChildDefBlockForListItem: boolean;
    queryChildDefBlockForHeadline: boolean;
    usePraentIdIdx: boolean;
    // 反链面板默认
    pageSize: number;
    backlinkBlockSortMethod: BlockSortMethod;
    filterPanelCurDocDefBlockSortMethod: BlockSortMethod;
    filterPanelRelatedDefBlockSortMethod: BlockSortMethod;
    filterPanelRelatedDocumentSortMethod: BlockSortMethod;


    // 插件设置
    dockDisplay: Boolean;
    documentBottomDisplay: boolean;
    topBarDisplan: boolean;
    //缓存
    cacheAfterResponseMs: number;
    cacheExpirationTime: number;

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
