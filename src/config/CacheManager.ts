import { BacklinkPanelFilterCriteria, IBacklinkFilterPanelData } from "@/models/backlink-model";
import { CacheUtil, generateKey } from "@/utils/cache-util";
import Instance from "@/utils/Instance";

export class CacheManager {


    public static get ins(): CacheManager {
        return Instance.get(CacheManager);
    }

    private backlinkPanelBaseDataCache: CacheUtil = new CacheUtil();
    private backlinkDocApiDataCache: CacheUtil = new CacheUtil();
    private backlinkFilterPanelDefaultCriteriaCache: CacheUtil = new CacheUtil();
    private backlinkPanelSavedCriteriaCache: CacheUtil = new CacheUtil();

    private dayTtl: number = 24 * 60 * 60 * 1000;



    public setBacklinkPanelBaseData(rootId: string, value: IBacklinkFilterPanelData, ttlSeconds: number) {
        this.backlinkPanelBaseDataCache.set(rootId, value, ttlSeconds * 1000);
    }
    public getBacklinkPanelBaseData(rootId: string): IBacklinkFilterPanelData {
        return this.backlinkPanelBaseDataCache.get(rootId);
    }
    public deleteBacklinkPanelBaseData(rootId: string) {
        this.backlinkPanelBaseDataCache.delete(rootId);
    }

    public setBacklinkDocApiData(defId: string, rootId: string, keyword: string, value: any, ttlSeconds: number) {
        let key = generateKey(defId, rootId, keyword);
        this.backlinkDocApiDataCache.set(key, value, ttlSeconds * 1000);
    }
    public getBacklinkDocApiData(defId: string, rootId: string, keyword: string): any {
        let key = generateKey(defId, rootId, keyword);
        return this.backlinkDocApiDataCache.get(key);
    }
    public deleteBacklinkDocApiData(defId: string,) {
        this.backlinkDocApiDataCache.clearByPrefix(defId);
    }

    public deleteBacklinkPanelAllCache(rootId: string) {
        this.deleteBacklinkPanelBaseData(rootId);
        this.deleteBacklinkDocApiData(rootId);
    }


    public setBacklinkFilterPanelDefaultCriteria(rootId: string, value: BacklinkPanelFilterCriteria) {
        this.backlinkFilterPanelDefaultCriteriaCache.set(rootId, value, this.dayTtl);
    }
    public getBacklinkFilterPanelDefaultCriteria(rootId: string): BacklinkPanelFilterCriteria {
        return this.backlinkFilterPanelDefaultCriteriaCache.get(rootId);
    }


    public setBacklinkPanelSavedCriteria(rootId: string, value: any) {
        this.backlinkPanelSavedCriteriaCache.set(rootId, value, this.dayTtl);
    }
    public getBacklinkPanelSavedCriteria(rootId: string): any {
        return this.backlinkPanelSavedCriteriaCache.get(rootId);
    }
}