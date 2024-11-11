<script lang="ts">
  import { canvasState, ObjectType } from "./canvas-store";
  import ImageObjectComponent from "./ImageObjectComponent.svelte";
</script>

{#each $canvasState.objects as localObject}
  {#if localObject.object.type == ObjectType.Image}
    <ImageObjectComponent {localObject} imageObject={localObject.object} />
  {:else}{/if}
{/each}
