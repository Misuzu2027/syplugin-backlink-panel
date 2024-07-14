import {
    Plugin,
    showMessage,
} from "siyuan";
import "@/index.scss";

import BacklinkPanelDockSvelte from "./components/dock/backlink-panel-dock.svelte";
import { EnvConfig } from "./config/env-config";

interface Item {
    id: number;
    filterStatus: 'SELECTED' | 'EXCLUDED' | string;
    updated: number;
}

export default class PluginSample extends Plugin {


    public sortItems(items: Item[]): Item[] {
        return items.sort((a, b) => {
            if (a.filterStatus !== b.filterStatus) {
                if (a.filterStatus == "SELECTED") {
                    return -1;
                } else if (b.filterStatus == "SELECTED") {
                    return 1;
                } else if (a.filterStatus == "EXCLUDED") {
                    return -1;
                } else if (b.filterStatus == "EXCLUDED") {
                    return 1;
                }
            }

            return Number(a.updated) - Number(b.updated);
        });
    }




    async onload() {
        EnvConfig.ins.init(this);

        this.addDocSearchDock();

    }

    onLayoutReady() {

    }

    async onunload() {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye SiYuan Plugin");
        console.log("onunload");
    }

    uninstall() {
        console.log("uninstall");
    }


    addDocSearchDock() {


        let docSearchSvelet: BacklinkPanelDockSvelte;
        let dockRet = this.addDock({
            config: {
                position: "RightBottom",
                size: { width: 300, height: 0 },
                icon: "iconGraph",
                title: "反链面板",
                show: false,
            },
            data: {},
            type: "backlink-panel-dock",
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
            },
            destroy() {
            }
        });

    }
}
