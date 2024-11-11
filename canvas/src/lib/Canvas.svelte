<script lang="ts">
  import { tweened } from "svelte/motion";
  import {
    canvasState,
    createObject,
    ObjectServerActionType,
    ObjectType,
    sendServerAction,
  } from "./canvas-store";
  import { cubicInOut } from "svelte/easing";
  import ImageObjectComponent from "./ImageObjectComponent.svelte";
  import FilePicker from "./FilePicker.svelte";

  const onPickFile = (url: string) => {
    createObject(
      {
        type: ObjectType.Image,
        url,
        width: 100,
        height: 100,
      },
      {
        x: 0,
        y: 0,
      }
    );
  };
</script>

<FilePicker {onPickFile} />

{#each canvasState.objects as localObject}
  {#if localObject.object.type == ObjectType.Image}
    <ImageObjectComponent {localObject} imageObject={localObject.object} />
  {:else}{/if}
{/each}
