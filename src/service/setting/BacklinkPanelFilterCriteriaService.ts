import { CacheManager } from "@/config/CacheManager";
import { IBacklinkPanelRednerFilterQueryParams, BacklinkPanelFilterCriteria } from "@/models/backlink-model";

import { getBlockAttrs, setBlockAttrs } from "@/utils/api";
import Instance from "@/utils/Instance";
import { SettingService } from "./SettingService";
import { setReplacer } from "@/utils/json-util";
import { mergeObjects } from "@/utils/object-util";

const BACKLINK_PANEL_DEFAULT_CONDISTIONS_ATRIBUTE_KEY = "custom-backlink-panel-default-condistions";
const BACKLINK_PANEL_SAVED_CONDISTIONS_ATTRIBUTE_KEY = "custom-backlink-panel-saved-condistions";
export class BacklinkPanelFilterCriteriaService {

    public static get ins(): BacklinkPanelFilterCriteriaService {
        return Instance.get(BacklinkPanelFilterCriteriaService);
    }


    public async getBacklinkPanelFilterCriteria(rootId: string): Promise<BacklinkPanelFilterCriteria> {
        let docuemntDefaultConfig = CacheManager.ins.getBacklinkPanelDefaultFilterCriteria(rootId);
        let queryParams;
        if (docuemntDefaultConfig) {
            let defaultQueryParams = getDefaultQueryParams();
            queryParams = mergeObjects(docuemntDefaultConfig.queryParams, defaultQueryParams);
        } else {
            queryParams = getDefaultQueryParams();
            docuemntDefaultConfig = new BacklinkPanelFilterCriteria();

            CacheManager.ins.setBacklinkPanelDefaultFilterCriteria(rootId, docuemntDefaultConfig);
        }

        docuemntDefaultConfig.queryParams = queryParams;

        // let attrsMap = await getBlockAttrs(rootId);
        // if (attrsMap && Object.keys(attrsMap).includes(BACKLINK_PANEL_DEFAULT_CONDISTIONS_ATRIBUTE_KEY)) {
        //     let json = attrsMap[BACKLINK_PANEL_DEFAULT_CONDISTIONS_ATRIBUTE_KEY];
        //     let parseObject = JSON.parse(json, setReviver) as BacklinkPanelConditions;
        //     if (parseObject instanceof BacklinkPanelConditions) {
        //         CacheManager.ins.setBacklinkPanelDefaultConditions(rootId, parseObject);
        //         return parseObject;
        //     }
        // }
        return docuemntDefaultConfig;
    }


    public async updateBacklinkPanelFilterCriteria(rootId: string, conditions: BacklinkPanelFilterCriteria) {
        if (!rootId) {
            return;
        }
        let lastConditions = await this.getBacklinkPanelFilterCriteria(rootId);
        let lastConditionsJson = "";
        if (lastConditions) {
            lastConditionsJson = JSON.stringify(lastConditions, setReplacer);
        }
        let conditionsJson = JSON.stringify(conditions, setReplacer);
        if (conditionsJson == lastConditionsJson) {
            return;
        }

        CacheManager.ins.setBacklinkPanelDefaultFilterCriteria(rootId, conditions);

        // let attrs = {};
        // attrs[BACKLINK_PANEL_DEFAULT_CONDISTIONS_ATRIBUTE_KEY] = conditionsJson;
        // setBlockAttrs(rootId, attrs);
    }






}




function getDefaultQueryParams(): IBacklinkPanelRednerFilterQueryParams {
    let settingConfig = SettingService.ins.SettingConfig;
    let pageSize = 8;
    let backlinkBlockSortMethod = "modifiedDesc";
    let filterPanelCurDocDefBlockSortMethod = "typeAndContent";
    let filterPanelRelatedDefBlockSortMethod = "modifiedDesc";
    let filterPanelRelatedDocumentSortMethod = "createdDesc";

    if (!settingConfig) {
        pageSize = settingConfig.pageSize ? settingConfig.pageSize : pageSize;
        backlinkBlockSortMethod = settingConfig.backlinkBlockSortMethod ? settingConfig.backlinkBlockSortMethod : backlinkBlockSortMethod;
        filterPanelCurDocDefBlockSortMethod = settingConfig.filterPanelCurDocDefBlockSortMethod ? settingConfig.filterPanelCurDocDefBlockSortMethod : filterPanelCurDocDefBlockSortMethod;
        filterPanelRelatedDefBlockSortMethod = settingConfig.filterPanelRelatedDefBlockSortMethod ? settingConfig.filterPanelRelatedDefBlockSortMethod : filterPanelRelatedDefBlockSortMethod;
        filterPanelRelatedDocumentSortMethod = settingConfig.filterPanelRelatedDocumentSortMethod ? settingConfig.filterPanelRelatedDocumentSortMethod : filterPanelRelatedDocumentSortMethod;
    }
    let queryParams = {
        keywordStr: "",
        pageNum: 1,
        pageSize: pageSize,
        backlinkBlockSortMethod: backlinkBlockSortMethod,
        includeRelatedDefBlockIds: new Set<string>(),
        excludeRelatedDefBlockIds: new Set<string>(),
        includeDocumentIds: new Set<string>(),
        excludeDocumentIds: new Set<string>(),
        filterPanelCurDocDefBlockSortMethod: filterPanelCurDocDefBlockSortMethod,
        filterPanelCurDocDefBlockKeywords: "",
        filterPanelRelatedDefBlockSortMethod: filterPanelRelatedDefBlockSortMethod,
        filterPanelRelatedDefBlockKeywords: "",
        filterPanelRelatedDocumentSortMethod: filterPanelRelatedDocumentSortMethod,
        filterPanelRelatedDocumentKeywords: "",
    } as IBacklinkPanelRednerFilterQueryParams;

    return queryParams;
}


