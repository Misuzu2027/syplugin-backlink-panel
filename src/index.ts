import {
    Plugin,
} from "siyuan";
import "@/index.scss";


import { EnvConfig } from "./config/EnvConfig";
import { CUSTOM_ICON_MAP } from "./models/icon-constant";
import { SettingService } from "./service/setting/SettingService";
import { initDock } from "./components/dock/dock-util";
import { openSettingsDialog } from "./components/setting/setting-util";


export default class PluginSample extends Plugin {


    async onload() {
        EnvConfig.ins.init(this);
        await SettingService.ins.init()
        initDock();

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
