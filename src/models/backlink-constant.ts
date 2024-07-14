import { EnvConfig } from "@/config/env-config";

export const DefinitionBlockStatus = {
    SELECTED: 'SELECTED',
    EXCLUDED: 'EXCLUDED',
    OPTIONAL: 'OPTIONAL',
    NOT_OPTIONAL: 'NOT_OPTIONAL',
};


export function BACKLINK_BLOCK_SORT_METHOD_ELEMENT(): { text: string, value: BlockSortMethod }[] {
    return [
        {
            text: EnvConfig.ins.i18n.modifiedASC,
            value: "modifiedAsc",
        },
        {
            text: EnvConfig.ins.i18n.modifiedDESC,
            value: "modifiedDesc",
        },
        {
            text: EnvConfig.ins.i18n.createdASC,
            value: "createdAsc",
        },
        {
            text: EnvConfig.ins.i18n.createdDESC,
            value: "createdDesc",
        },
        {
            text: EnvConfig.ins.i18n.fileNameASC,
            value: "alphabeticAsc",
        },
        {
            text: EnvConfig.ins.i18n.fileNameDESC,
            value: "alphabeticDesc",
        },
    ];
}



export function CUR_DOC_DEF_BLOCK_SORT_METHOD_ELEMENT(): { text: string, value: BlockSortMethod }[] {

    return [
        {
            text: EnvConfig.ins.i18n.type,
            value: "typeAndContent",
        },
        {
            text: EnvConfig.ins.i18n.refCountASC,
            value: "refCountAsc",
        },
        {
            text: EnvConfig.ins.i18n.refCountDESC,
            value: "refCountDesc",
        },
    ];
}

export function RELATED_DEF_BLOCK_SORT_METHOD_ELEMENT(): { text: string, value: BlockSortMethod }[] {

    return [
        {
            text: EnvConfig.ins.i18n.refCountASC,
            value: "refCountAsc",
        },
        {
            text: EnvConfig.ins.i18n.refCountDESC,
            value: "refCountDesc",
        }, {
            text: EnvConfig.ins.i18n.modifiedASC,
            value: "modifiedAsc",
        },
        {
            text: EnvConfig.ins.i18n.modifiedDESC,
            value: "modifiedDesc",
        },
        {
            text: EnvConfig.ins.i18n.createdASC,
            value: "createdAsc",
        },
        {
            text: EnvConfig.ins.i18n.createdDESC,
            value: "createdDesc",
        },
        {
            text: EnvConfig.ins.i18n.fileNameASC,
            value: "alphabeticAsc",
        },
        {
            text: EnvConfig.ins.i18n.fileNameDESC,
            value: "alphabeticDesc",
        },
    ];
}



export function RELATED_DOCMUMENT_SORT_METHOD_ELEMENT(): { text: string, value: BlockSortMethod }[] {

    return [
        {
            text: EnvConfig.ins.i18n.refCountASC,
            value: "refCountAsc",
        },
        {
            text: EnvConfig.ins.i18n.refCountDESC,
            value: "refCountDesc",
        }, {
            text: EnvConfig.ins.i18n.modifiedASC,
            value: "modifiedAsc",
        },
        {
            text: EnvConfig.ins.i18n.modifiedDESC,
            value: "modifiedDesc",
        },
        {
            text: EnvConfig.ins.i18n.createdASC,
            value: "createdAsc",
        },
        {
            text: EnvConfig.ins.i18n.createdDESC,
            value: "createdDesc",
        },
        {
            text: EnvConfig.ins.i18n.fileNameASC,
            value: "alphabeticAsc",
        },
        {
            text: EnvConfig.ins.i18n.fileNameDESC,
            value: "alphabeticDesc",
        },
    ];
}
