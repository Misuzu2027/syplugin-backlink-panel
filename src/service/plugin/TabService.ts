import { EnvConfig } from "@/config/EnvConfig";
import BacklinkFilterPanelPageSvelte from "@/components/panel/backlink-filter-panel-page.svelte";
import Instance from "@/utils/Instance";
import { openTab } from "siyuan";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import { isStrBlank } from "@/utils/string-util";
import { clearProtyleGutters } from "@/utils/html-util";


const BACKLINK_TAB_PREFIX = "backlink_tab_"

export class TabService {


    public static get ins(): TabService {
        return Instance.get(TabService);
    }



    public openBacklinkTab(docTitle: string, docId: string, focusBlockId: string) {
        if (isStrBlank(docTitle) || isStrBlank(docId) ) {
            console.log("反链过滤面板插件 打开反链页签错误，参数缺失")
            return;
        }
        let backlinkFilterPanelPageSvelte: BacklinkFilterPanelPageSvelte;

        let tabId = BACKLINK_TAB_PREFIX + docId;

        EnvConfig.ins.plugin.addTab({
            type: tabId,
            init() {
                backlinkFilterPanelPageSvelte = new BacklinkFilterPanelPageSvelte({
                    target: this.element,
                    props: {
                        rootId: docId,
                        focusBlockId: focusBlockId,
                    }
                });

                this.element.addEventListener(
                    "scroll",
                    () => {
                        clearProtyleGutters(this.element);
                    },
                );
            },
            beforeDestroy() {
                backlinkFilterPanelPageSvelte?.$destroy();
            },
            destroy() {
            },
            resize() {

            },
        });

        openTab({
            app: EnvConfig.ins.app,
            custom: {
                id: EnvConfig.ins.plugin.name + tabId,
                icon: CUSTOM_ICON_MAP.BacklinkPanelFilter.id,
                title: docTitle,
            },
            position: "right",
            afterOpen() {

            }
        });
    }

}
