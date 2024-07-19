<script lang="ts" setup>
    import { ItemProperty } from "@/models/setting-model";
    import { SettingService } from "@/service/setting/SettingService";

    export let itemProperty: ItemProperty;
    let checked = SettingService.ins.SettingConfig[itemProperty.key];

    function selectChange() {
        SettingService.ins.updateSettingCofnigValue(itemProperty.key, checked);
    }
</script>

<input
    class="b3-switch fn__flex-center"
    type="checkbox"
    bind:checked
    on:change={selectChange}
/>
