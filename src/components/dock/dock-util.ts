import { EnvConfig } from "@/config/EnvConfig";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import BacklinkPanelDockSvelte from "@/components/dock/backlink-panel-dock.svelte";


const BACKLINK_PANEL_DOCK_TYPE = "backlink-panel-dock";


export function initDock() {
    addBacklinkPanelDock();
}

function addBacklinkPanelDock() {
    if (!EnvConfig.ins || !EnvConfig.ins.plugin) {
        console.log("添加反链面板 dock 失败。")
        return;
    }
    let plugin = EnvConfig.ins.plugin;
    let docSearchSvelet: BacklinkPanelDockSvelte;
    let dockRet = plugin.addDock({
        config: {
            position: "RightBottom",
            size: { width: 300, height: 0 },
            icon: CUSTOM_ICON_MAP.BacklinkPanelFilter.id,
            title: "反链面板",
            show: false,
        },
        data: {},
        type: BACKLINK_PANEL_DOCK_TYPE,
        resize() {
            if (docSearchSvelet) {
                docSearchSvelet.resize(this.element.clientWidth);
            }
        },
        update() {
        },
        init() {
            this.element.innerHTML = "";
            docSearchSvelet = new BacklinkPanelDockSvelte({
                target: this.element,
                props: {
                }
            });

            if (EnvConfig.ins.isMobile) {
                docSearchSvelet.resize(1);
            }
        },
        destroy() {
        }
    });
    // EnvConfig.ins.docSearchDock = dockRet;
}
