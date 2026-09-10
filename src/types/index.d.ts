/*
 * Copyright (c) 2024 by frostime. All Rights Reserved.
 * @Author       : frostime
 * @Date         : 2023-08-15 10:28:10
 * @FilePath     : /src/types/index.d.ts
 * @LastEditTime : 2024-06-08 20:50:53
 * @Description  : Frequently used data structures in SiYuan
 */


type DocumentId = string;
type BlockId = string;
type NotebookId = string;
type PreviousID = BlockId;
type ParentID = BlockId | DocumentId;

type Notebook = {
    id: NotebookId;
    name: string;
    icon: string;
    sort: number;
    closed: boolean;
}

type NotebookConf = {
    name: string;
    closed: boolean;
    refCreateSavePath: string;
    createDocNameTemplate: string;
    dailyNoteSavePath: string;
    dailyNoteTemplatePath: string;
}

// type BlockType = "d" | "s" | "h" | "t" | "i" | "p" | "f" | "audio" | "video" | "other";

type BlockType = "d"  // 文档
    | "h" // 标题
    | "l" // 列表
    | "i" // 列表项
    | "c" // 代码块
    | "m" // 数学公式
    | "t" // 表格
    | "b" // 引述
    | "av" // 属性视图（数据库）
    | "s" // 超级块
    | "p" // 段落
    | "tb" // -- 分隔线
    | "html" // HTML
    | "video" // 视频
    | "audio" // 音频
    | "widget" // 挂件
    | "iframe" // iframe
    | "query_embed" // 嵌入块
    ;

type BlockSubType = "o" | "u" | "t" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type Block = {
    id: BlockId;
    parent_id?: BlockId;
    root_id: DocumentId;
    hash: string;
    box: string;
    path: string;
    hpath: string;
    name: string;
    alias: string;
    memo: string;
    tag: string;
    content: string;
    fcontent?: string;
    markdown: string;
    length: number;
    type: BlockType;
    subtype: BlockSubType;
    /** string of { [key: string]: string } 
     * For instance: "{: custom-type=\"query-code\" id=\"20230613234017-zkw3pr0\" updated=\"20230613234509\"}" 
     */
    ial?: string;
    sort: number;
    created: string;
    updated: string;
}

type doOperation = {
    action: string;
    data: string;
    id: BlockId;
    parentID: BlockId | DocumentId;
    previousID: BlockId;
    retData: null;
}

interface Window {
    siyuan: {
        config: any;
        notebooks: any;
        menus: any;
        dialogs: any;
        blockPanels: any;
        storage: any;
        user: any;
        ws: any;
        languages: any;
        emojis: any;
    };
}


interface IMenu {
    iconClass?: string,
    label?: string,
    click?: (element: HTMLElement, event: MouseEvent) => boolean | void | Promise<boolean | void>
    type?: "separator" | "submenu" | "readonly" | "empty",
    accelerator?: string,
    action?: string,
    id?: string,
    submenu?: IMenu[]
    disabled?: boolean
    icon?: string
    iconHTML?: string
    current?: boolean
    bind?: (element: HTMLElement) => void
    index?: number
    element?: HTMLElement
}


type DockPosition = "Hidden" | "LeftTop" | "LeftBottom" | "RightTop" | "RightBottom" | "BottomLeft" | "BottomRight";




/**
 * 反链相关
 */


interface IBreadcrumb {
    id: string;
    name: string;
    type: string;
    subType: string;
    children: [];
}

interface IBacklinkAVMatch {
    itemID: string;
    keyID: string;
    valueID: string;
    title: string;
    keyName: string;
    defIDs: string[];
}

interface IBacklinkAVTarget {
    blockID: string;
    matches: IBacklinkAVMatch[];
}

interface IBacklinkAVItemPreview {
    avID: string;
    itemID: string;
    valueID: string;
    title: string;
    keyIDs: string[];
    valueIDs: string[];
    databaseBlockID: string;
    notebookId: string;
}

interface IAttributeViewItemKey {
    type: string;
    name: string;
    desc?: string;
    icon?: string;
    id: string;
    dateFormat?: string;
    renderTemplate?: string;
    options?: { name: string, color: string }[];
}

interface IAttributeViewCellValue {
    keyID?: string;
    id?: string;
    blockID?: string;
    isDetached?: boolean;
    type?: string;
    renderedContent?: string;
    text?: { content?: string, rich?: { content?: string } };
    block?: { id?: string, content?: string, icon?: string };
    number?: { content?: number, isNotEmpty?: boolean, formattedContent?: string };
    mSelect?: { content?: string, color?: string }[];
    date?: IAttributeViewDateValue;
    created?: IAttributeViewDateValue;
    updated?: IAttributeViewDateValue;
    url?: { content?: string };
    email?: { content?: string };
    phone?: { content?: string };
    checkbox?: { checked?: boolean };
    relation?: { contents?: IAttributeViewCellValue[], blockIDs?: string[] };
    mAsset?: { type?: string, name?: string, content?: string }[];
    template?: { content?: string };
    rollup?: { contents?: IAttributeViewCellValue[] };
}

interface IAttributeViewDateValue {
    content?: number;
    content2?: number;
    isNotEmpty?: boolean;
    isNotEmpty2?: boolean;
    isNotTime?: boolean;
    hasEndDate?: boolean;
    formattedContent?: string;
}

interface IAttributeViewItemKeyValue {
    key: IAttributeViewItemKey;
    values: IAttributeViewCellValue[];
}

interface IAttributeViewItemKeys {
    keyValues: IAttributeViewItemKeyValue[];
    blockIDs: string[];
    avID: string;
    avName: string;
}

interface IBacklinkData {
    // 内核返回的反链单位块 id。传递型反链下它是文档块 / 标题块 id，
    // 而渲染 DOM 的根节点是该单位的第一个子块，两者并不相同。
    id?: string;
    // 数据库文本单元格引用：内核附带命中行/列，官方 Protyle 用来定位并高亮对应单元格。
    attributeViewTargets?: IBacklinkAVTarget[];
    // 镜像合并后的条目预览：一条反链对应一个数据库条目（主键）。
    avItemPreview?: IBacklinkAVItemPreview;
    blockPaths: IBreadcrumb[];
    dom: string;
    expand: boolean;
    backlinkBlock: Block;
    includeChildListItemIdArray: string[];
    excludeChildLisetItemIdArray: string[];
}



interface IProtyleOption {
    backlinkData?: IBacklinkData[];
    action?: TProtyleAction[];
    mode?: TEditorMode;
    toolbar?: Array<string | IToolbarItem>;
    blockId?: string;
    key?: string;
    scrollAttr?: {
        rootId: string,
        startId: string,
        endId: string,
        scrollTop: number,
        focusId?: string,
        focusStart?: number,
        focusEnd?: number,
        zoomInId?: string,
    };
    defId?: string;
    render?: {
        background?: boolean,
        title?: boolean,
        gutter?: boolean,
        scroll?: boolean,
        breadcrumb?: boolean,
        breadcrumbDocName?: boolean,
    };
    typewriterMode?: boolean;

    after?(protyle: Protyle): void;
}