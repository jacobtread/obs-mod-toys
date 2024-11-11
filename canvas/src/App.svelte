<script lang="ts">
  import Canvas from "./lib/Canvas.svelte";
  import CanvasActions from "./lib/CanvasActions.svelte";

  const url = new URLSearchParams(window.location.search);

  const isViewMode = url.get("view") !== null;
</script>

{#if !isViewMode}
  <CanvasActions />
{/if}

<Canvas />
