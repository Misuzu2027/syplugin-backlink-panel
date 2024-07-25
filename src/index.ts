import {
    Plugin,
} from "siyuan";
import "@/index.scss";


import { EnvConfig } from "./config/EnvConfig";
import { CUSTOM_ICON_MAP } from "./models/icon-constant";
import { SettingService } from "./service/setting/SettingService";
import { openSettingsDialog } from "./components/setting/setting-util";
import { DocumentService } from "./components/document/DocumentService";
import { DockService } from "./components/dock/DockServices";


export default class PluginSample extends Plugin {


    async onload() {
        EnvConfig.ins.init(this);
        await SettingService.ins.init()
        DocumentService.ins.init();
        DockService.ins.init();

        // 图标的制作参见帮助文档
        for (const key in CUSTOM_ICON_MAP) {
            if (Object.prototype.hasOwnProperty.call(CUSTOM_ICON_MAP, key)) {
                const item = CUSTOM_ICON_MAP[key];
                this.addIcons(item.source);
            }
        }

        this.eventBus.on('switch-protyle', (e: any) => {
            EnvConfig.ins.lastViewedDocId = e.detail.protyle.block.rootID;
        })
        this.eventBus.on('loaded-protyle-static', (e: any) => {
            // console.log("index loaded-protyle-static ")
            if (EnvConfig.ins.isMobile && !EnvConfig.ins.lastViewedDocId) {
                EnvConfig.ins.lastViewedDocId = e.detail.protyle.block.rootID;
            }
        })
    }

    onLayoutReady() {

    }

    async onunload() {
    }

    uninstall() {
        // console.log("uninstall");
    }


    openSetting(): void {
        openSettingsDialog();
    }


}
