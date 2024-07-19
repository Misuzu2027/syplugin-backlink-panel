import { BacklinkPanelFilterCriteria, IBacklinkPanelData } from "@/models/backlink-model";
import { CacheUtil, generateKey } from "@/utils/cache-util";
import Instance from "@/utils/Instance";

export class CacheManager {


    public static get ins(): CacheManager {
        return Instance.get(CacheManager);
    }

    private backlinkPanelBaseDataCache: CacheUtil = new CacheUtil();
    private backlinkDocApiDataCache: CacheUtil = new CacheUtil();
    private backlinkPanelDefaultFilterCriteriaCache: CacheUtil = new CacheUtil();
    private backlinkPanelSavedConditionsCache: CacheUtil = new CacheUtil();

    private dayTtl: number = 24 * 60 * 60 * 1000;



    public setBacklinkPanelBaseData(rootId: string, value: IBacklinkPanelData, ttlSeconds: number) {
        this.backlinkPanelBaseDataCache.set(rootId, value, ttlSeconds * 1000);
    }
    public getBacklinkPanelBaseData(rootId: string): IBacklinkPanelData {
        return this.backlinkPanelBaseDataCache.get(rootId);
    }
    public deleteBacklinkPanelBaseData(rootId: string) {
        this.backlinkPanelBaseDataCache.delete(rootId);
    }

    public setBacklinkDocApiData(defId: string, rootId: string, value: any, ttlSeconds: number) {
        let key = generateKey(defId, rootId);
        this.backlinkDocApiDataCache.set(key, value, ttlSeconds * 1000);
    }
    public getBacklinkDocApiData(defId: string, rootId: string,): any {
        let key = generateKey(defId, rootId);
        return this.backlinkDocApiDataCache.get(key);
    }
    public deleteBacklinkDocApiData(defId: string,) {
        this.backlinkDocApiDataCache.clearByPrefix(defId);
    }

    public deleteBacklinkPanelAllCache(rootId: string) {
        this.deleteBacklinkPanelBaseData(rootId);
        this.deleteBacklinkDocApiData(rootId);
    }


    public setBacklinkPanelDefaultFilterCriteria(rootId: string, value: BacklinkPanelFilterCriteria) {
        this.backlinkPanelDefaultFilterCriteriaCache.set(rootId, value, this.dayTtl);
    }
    public getBacklinkPanelDefaultFilterCriteria(rootId: string): BacklinkPanelFilterCriteria {
        return this.backlinkPanelDefaultFilterCriteriaCache.get(rootId);
    }


    public setBacklinkPanelSavedConditions(rootId: string, value: any) {
        this.backlinkPanelSavedConditionsCache.set(rootId, value, this.dayTtl);
    }
    public getBacklinkPanelSavedConditions(rootId: string): any {
        return this.backlinkPanelSavedConditionsCache.get(rootId);
    }
}