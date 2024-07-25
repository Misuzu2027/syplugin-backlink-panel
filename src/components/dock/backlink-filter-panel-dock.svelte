<script lang="ts">
    import { EnvConfig } from "@/config/EnvConfig";
    import { onMount } from "svelte";
    import BacklinkFilterPanelPageSvelte from "@/components/panel/backlink-filter-panel-page.svelte";

    let isMobile = false;
    let dockActive: boolean;
    let lastRootId: string;

    let rootId: string;
    let focusBlockId;

    // let rootElement: HTMLElement;

    onMount(async () => {
        init();
    });

    export function resize(clientWidth?: number) {
        if (clientWidth && clientWidth > 0) {
            dockActive = true;
            rootId = lastRootId;
        } else {
            dockActive = false;
        }
    }

    async function init() {
        isMobile = EnvConfig.ins.isMobile;
        lastRootId = EnvConfig.ins.lastViewedDocId;
        EnvConfig.ins.plugin.eventBus.on("switch-protyle", (e: any) => {
            switchProtyleCallback(e);
        });
    }

    async function switchProtyleCallback(e) {
        if (e && e.detail && e.detail.protyle && e.detail.protyle.block) {
            lastRootId = e.detail.protyle.block.rootID;
            if (dockActive) {
                rootId = lastRootId;
            }
        }
    }
</script>

{#if isMobile}
    <!-- <div class="toolbar toolbar--border toolbar--dark">
        <svg class="toolbar__icon"
            ><use xlink:href="#BacklinkPanelFilter"></use></svg
        >
        <div class="toolbar__text">{EnvConfig.ins.i18n.flatDocumentTree}</div>
    </div> -->
    <div class="">
        <BacklinkFilterPanelPageSvelte {rootId} {focusBlockId} />
    </div>
{:else}
    <div class="fn__flex-column">
        <BacklinkFilterPanelPageSvelte {rootId} {focusBlockId} />
    </div>
{/if}
