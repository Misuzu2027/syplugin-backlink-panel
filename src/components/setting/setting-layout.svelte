<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { EnvConfig } from "@/config/EnvConfig";

    export let tabs: { key: string; label: string; icon?: string }[] = [];
    export let activeTab = "";
    export let sidebarWidth = 240;
    export let minSidebarWidth = 180;
    export let maxSidebarWidth = 420;
    export let storageKey = "syplugin-backlink-panel-setting-sidebar-width";
    export let mobile = false;

    let layoutEl: HTMLDivElement;
    let sidebarWidthPx = sidebarWidth;
    let dragging = false;

    function t(key: string, fallback: string): string {
        return (EnvConfig.ins.i18n as Record<string, string>)?.[key] ?? fallback;
    }

    function clamp(width: number) {
        return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, width));
    }

    function loadWidth() {
        const saved = localStorage.getItem(storageKey);
        if (!saved) {
            return;
        }
        const width = Number(saved);
        if (!Number.isNaN(width)) {
            sidebarWidthPx = clamp(width);
        }
    }

    function saveWidth() {
        localStorage.setItem(storageKey, String(sidebarWidthPx));
    }

    function onResizeStart(event: PointerEvent) {
        event.preventDefault();
        dragging = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function onResizeMove(event: PointerEvent) {
        if (!dragging || !layoutEl) {
            return;
        }
        const rect = layoutEl.getBoundingClientRect();
        sidebarWidthPx = clamp(event.clientX - rect.left);
    }

    function onResizeEnd(event: PointerEvent) {
        if (!dragging) {
            return;
        }
        dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (event.currentTarget instanceof HTMLElement) {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                // already released
            }
        }
        saveWidth();
    }

    function selectTab(key: string) {
        activeTab = key;
    }

    onMount(() => {
        loadWidth();
    });

    onDestroy(() => {
        dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
</script>

<div
    bind:this={layoutEl}
    class="setting-layout fn__flex-1 fn__flex config__panel"
    class:setting-page--mobile={mobile}
    style="--setting-sidebar-width: {sidebarWidthPx}px; --setting-sidebar-min-width: {minSidebarWidth}px; --setting-sidebar-max-width: {maxSidebarWidth}px;"
>
    <ul class="setting-layout__sidebar b3-tab-bar b3-list b3-list--background">
        {#each tabs as tab (tab.key)}
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <li
                class="b3-list-item"
                class:b3-list-item--focus={activeTab === tab.key}
                on:click={() => selectTab(tab.key)}
                on:keydown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectTab(tab.key);
                    }
                }}
            >
                {#if tab.icon}
                    <svg class="b3-list-item__graphic">
                        <use xlink:href={"#" + tab.icon}></use>
                    </svg>
                {/if}
                <span class="b3-list-item__text">{tab.label}</span>
            </li>
        {/each}
    </ul>

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="setting-layout__resizer"
        class:setting-layout__resizer--active={dragging}
        role="separator"
        aria-orientation="vertical"
        title={t("settingLayoutResizerTitle", "拖动调整宽度")}
        on:pointerdown={onResizeStart}
        on:pointermove={onResizeMove}
        on:pointerup={onResizeEnd}
        on:pointercancel={onResizeEnd}
    ></div>

    <div class="config__tab-wrap setting-layout__content">
        <slot />
    </div>
</div>

<style>
    .setting-layout {
        width: 100%;
        height: 100%;
        min-width: 0;
    }

    .setting-layout > .setting-layout__sidebar.b3-tab-bar {
        flex: 0 0 var(--setting-sidebar-width);
        width: var(--setting-sidebar-width) !important;
        min-width: var(--setting-sidebar-min-width);
        max-width: var(--setting-sidebar-max-width);
        overflow-x: hidden;
        overflow-y: auto;
        box-sizing: border-box;
    }

    .setting-layout__sidebar :global(.b3-list-item) {
        padding-left: 1rem;
        padding-right: 0.75rem;
        white-space: nowrap;
    }

    .setting-layout__sidebar :global(.b3-list-item__text) {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .setting-layout__resizer {
        flex: 0 0 6px;
        margin: 0 -2px;
        cursor: col-resize;
        position: relative;
        z-index: 1;
        touch-action: none;
        transition: background-color 0.15s ease;
    }

    .setting-layout__resizer::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 2px;
        width: 2px;
        background-color: transparent;
        transition: background-color 0.15s ease;
    }

    .setting-layout__resizer:hover::after,
    .setting-layout__resizer--active::after {
        background-color: var(--b3-theme-primary);
    }

    .setting-layout__content {
        flex: 1 1 auto;
        min-width: 0;
        overflow: auto;
    }
</style>
