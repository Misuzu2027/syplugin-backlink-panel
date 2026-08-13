<script lang="ts">
    import { getSettingTabArray } from "@/models/setting-constant";
    import { EnvConfig } from "@/config/EnvConfig";
    import SettingLayout from "./setting-layout.svelte";
    import SettingItem from "./setting-item.svelte";
    import SettingSwitch from "./inputs/setting-switch.svelte";
    import SettingSelect from "./inputs/setting-select.svelte";
    import SettingInput from "./inputs/setting-input.svelte";
    import { SettingService } from "@/service/setting/SettingService";

    let tabArray = getSettingTabArray();
    let activeTab = tabArray[0].key;
    let isMobile = EnvConfig.ins.isMobile;
    let tabs = tabArray.map((tab) => ({
        key: tab.key,
        label: tab.name,
        icon: tab.iconKey,
    }));

    SettingService.ins.init();
</script>

<SettingLayout
    {tabs}
    bind:activeTab
    mobile={isMobile}
    sidebarWidth={isMobile ? 168 : 240}
    minSidebarWidth={isMobile ? 140 : 180}
    maxSidebarWidth={isMobile ? 240 : 420}
    storageKey={isMobile
        ? "syplugin-backlink-panel-setting-sidebar-width-mobile"
        : "syplugin-backlink-panel-setting-sidebar-width"}
>
    {#each tabArray as tab (tab.key)}
        {#if activeTab === tab.key}
            <div class="config__tab-container">
                {#each tab.props as itemProperty (itemProperty.key)}
                    <SettingItem {itemProperty}>
                        {#if itemProperty.type == "switch"}
                            <SettingSwitch {itemProperty}></SettingSwitch>
                        {:else if itemProperty.type == "select"}
                            <SettingSelect {itemProperty}></SettingSelect>
                        {:else if itemProperty.type == "number" || itemProperty.type == "text"}
                            <SettingInput {itemProperty} />
                        {:else}
                            不能载入设置项，请检查设置代码实现。 Key: {itemProperty.key}
                            <br />
                            can't load settings, check code please. Key:
                            {itemProperty.key}
                        {/if}
                    </SettingItem>
                {/each}
            </div>
        {/if}
    {/each}
</SettingLayout>

<style>
    :global(.setting-page--mobile .config__item) {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }

    :global(.setting-page--mobile .fn__space) {
        display: none;
    }

    :global(.setting-page--mobile .b3-select),
    :global(.setting-page--mobile .b3-text-field) {
        width: 100%;
        max-width: none;
    }
</style>
