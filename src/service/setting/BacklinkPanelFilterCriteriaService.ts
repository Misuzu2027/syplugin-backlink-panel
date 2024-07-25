import { CacheManager } from "@/config/CacheManager";
import { IPanelRednerFilterQueryParams, BacklinkPanelFilterCriteria } from "@/models/backlink-model";

import { getBlockAttrs, setBlockAttrs } from "@/utils/api";
import Instance from "@/utils/Instance";
import { SettingService } from "./SettingService";
import { setReplacer, setReviver } from "@/utils/json-util";
import { mergeObjects } from "@/utils/object-util";

const BACKLINK_FILTER_PANEL_DEFAULT_CRITERIA_ATRIBUTE_KEY = "custom-backlink-filter-panel-default-criteria";
const BACKLINK_FILTER_PANEL_SAVED_CRITERIA_ATTRIBUTE_KEY = "custom-backlink-filter-panel-saved-criteria";
export class BacklinkFilterPanelCriteriaService {

    public static get ins(): BacklinkFilterPanelCriteriaService {
        return Instance.get(BacklinkFilterPanelCriteriaService);
    }


    public async getPanelCriteria(rootId: string): Promise<BacklinkPanelFilterCriteria> {
        let documentPanelCriteria = CacheManager.ins.getBacklinkFilterPanelDefaultCriteria(rootId);
        let queryParams;
        if (documentPanelCriteria) {
            let defaultQueryParams = this.getDefaultQueryParams();
            queryParams = mergeObjects(documentPanelCriteria.queryParams, defaultQueryParams);
        } else {
            queryParams = this.getDefaultQueryParams();
            documentPanelCriteria = new BacklinkPanelFilterCriteria();

            CacheManager.ins.setBacklinkFilterPanelDefaultCriteria(rootId, documentPanelCriteria);
        }

        documentPanelCriteria.queryParams = queryParams;

        // let attrsMap = await getBlockAttrs(rootId);
        // if (attrsMap && Object.keys(attrsMap).includes(BACKLINK_FILTER_PANEL_DEFAULT_CRITERIA_ATRIBUTE_KEY)) {
        //     let json = attrsMap[BACKLINK_FILTER_PANEL_DEFAULT_CRITERIA_ATRIBUTE_KEY];
        //     let parseObject = JSON.parse(json, setReviver) as BacklinkPanelCriteria;
        //     if (parseObject instanceof BacklinkPanelCriteria) {
        //         CacheManager.ins.setBacklinkPanelDefaultCriteria(rootId, parseObject);
        //         return parseObject;
        //     }
        // }
        // console.log("getBacklinkPanelFilterCriteria queryParams", queryParams)
        return documentPanelCriteria;
    }


    public async updatePanelCriteria(rootId: string, criteria: BacklinkPanelFilterCriteria) {
        if (!rootId) {
            return;
        }
        let lastCriteria = await this.getPanelCriteria(rootId);
        let lastCriteriaJson = "";
        if (lastCriteria) {
            lastCriteriaJson = JSON.stringify(lastCriteria, setReplacer);
        }
        let riteriaJson = JSON.stringify(criteria, setReplacer);
        if (riteriaJson == lastCriteriaJson) {
            return;
        }

        CacheManager.ins.setBacklinkFilterPanelDefaultCriteria(rootId, criteria);

        // let attrs = {};
        // attrs[BACKLINK_FILTER_PANEL_DEFAULT_CRITERIA_ATRIBUTE_KEY] = criteriaJson;
        // setBlockAttrs(rootId, attrs);
    }


    public async getPanelSavedCriteriaMap(rootId: string): Promise<Map<string, IPanelRednerFilterQueryParams>> {
        let savedCriteriaMap = CacheManager.ins.getBacklinkPanelSavedCriteria(rootId);
        if (savedCriteriaMap && savedCriteriaMap.size > 0) {
            return savedCriteriaMap
        }

        let attrsMap = await getBlockAttrs(rootId);
        console.log("getPanelSavedCriteriaMap attrsMap : ", attrsMap)
        if (attrsMap && Object.keys(attrsMap).includes(BACKLINK_FILTER_PANEL_SAVED_CRITERIA_ATTRIBUTE_KEY)) {
            let json = attrsMap[BACKLINK_FILTER_PANEL_SAVED_CRITERIA_ATTRIBUTE_KEY];
            let parseObject = JSON.parse(json, setReviver);
            if (parseObject) {
                const resultMap = new Map<string, IPanelRednerFilterQueryParams>(Object.entries(parseObject));
                CacheManager.ins.setBacklinkPanelSavedCriteria(rootId, resultMap);
                return resultMap;
            }
        }

        return new Map();
    }


    public async updatePanelSavedCriteriaMap(rootId: string, criteriaMap: Map<string, IPanelRednerFilterQueryParams>) {
        if (!rootId) {
            return;
        }
        // let lastCriteriaMap = await this.getPanelSavedCriteriaMap(rootId);
        // let lastCriteriaJson = "";
        // if (lastCriteriaMap) {
        //     const obj = Object.fromEntries(lastCriteriaMap);
        //     lastCriteriaJson = JSON.stringify(obj, setReplacer);
        // }
        const mapObject = Object.fromEntries(criteriaMap);
        let criteriaJson = JSON.stringify(mapObject, setReplacer);
        // if (criteriaJson == lastCriteriaJson) {
        //     return;
        // }

        CacheManager.ins.setBacklinkPanelSavedCriteria(rootId, criteriaMap);

        let attrs = {};
        attrs[BACKLINK_FILTER_PANEL_SAVED_CRITERIA_ATTRIBUTE_KEY] = criteriaJson;
        setBlockAttrs(rootId, attrs);
    }



    getDefaultQueryParams(): IPanelRednerFilterQueryParams {
        let settingConfig = SettingService.ins.SettingConfig;
        let pageSize = 8;
        let backlinkBlockSortMethod = "modifiedDesc";
        let filterPanelCurDocDefBlockSortMethod = "typeAndContent";
        let filterPanelRelatedDefBlockSortMethod = "modifiedDesc";
        let filterPanelbacklinkDocumentSortMethod = "createdDesc";

        if (!settingConfig) {
            pageSize = settingConfig.pageSize ? settingConfig.pageSize : pageSize;
            backlinkBlockSortMethod = settingConfig.backlinkBlockSortMethod ? settingConfig.backlinkBlockSortMethod : backlinkBlockSortMethod;
            filterPanelCurDocDefBlockSortMethod = settingConfig.filterPanelCurDocDefBlockSortMethod ? settingConfig.filterPanelCurDocDefBlockSortMethod : filterPanelCurDocDefBlockSortMethod;
            filterPanelRelatedDefBlockSortMethod = settingConfig.filterPanelRelatedDefBlockSortMethod ? settingConfig.filterPanelRelatedDefBlockSortMethod : filterPanelRelatedDefBlockSortMethod;
            filterPanelbacklinkDocumentSortMethod = settingConfig.filterPanelBacklinkDocumentSortMethod ? settingConfig.filterPanelBacklinkDocumentSortMethod : filterPanelbacklinkDocumentSortMethod;
        }
        let queryParams = {
            pageNum: 1,
            pageSize: pageSize,
            backlinkCurDocDefBlockType: "all",
            backlinkBlockSortMethod: backlinkBlockSortMethod,
            backlinkKeywordStr: "",
            includeRelatedDefBlockIds: new Set<string>(),
            excludeRelatedDefBlockIds: new Set<string>(),
            includeDocumentIds: new Set<string>(),
            excludeDocumentIds: new Set<string>(),
            filterPanelCurDocDefBlockSortMethod: filterPanelCurDocDefBlockSortMethod,
            filterPanelCurDocDefBlockKeywords: "",
            filterPanelRelatedDefBlockType: "all",
            filterPanelRelatedDefBlockSortMethod: filterPanelRelatedDefBlockSortMethod,
            filterPanelRelatedDefBlockKeywords: "",
            filterPanelBacklinkDocumentSortMethod: filterPanelbacklinkDocumentSortMethod,
            filterPanelBacklinkDocumentKeywords: "",
        } as IPanelRednerFilterQueryParams;

        return queryParams;
    }







}


