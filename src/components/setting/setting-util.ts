import { EnvConfig } from "@/config/EnvConfig";
import { Dialog } from "siyuan";
import SettingPageSvelte from "@/components/setting/setting-page.svelte";

export function getSettingDialogSize() {
    const isMobile = EnvConfig.ins.isMobile;
    return {
        width: isMobile ? "92vw" : "1040px",
        height: isMobile ? "75vh" : "80vh",
    };
}

export function openSettingsDialog() {
    const { width, height } = getSettingDialogSize();
    const dialogId = "backlink-panel-setting-" + Date.now();
    let settingPage: SettingPageSvelte | null = null;

    const settingDialog = new Dialog({
        title:
            (EnvConfig.ins.i18n as Record<string, string>)?.settingDialogTitle ??
            "反链面板插件设置",
        content: `
          <div  id="${dialogId}" style="overflow: hidden; position: relative;height: 100%;"></div>
          `,
        width,
        height,
        destroyCallback: () => {
            settingPage?.$destroy();
            settingPage = null;
        },
    });

    settingPage = new SettingPageSvelte({
        target: settingDialog.element.querySelector(`#${dialogId}`),
    });
}
