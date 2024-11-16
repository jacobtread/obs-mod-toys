<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    moveObject,
    type DefinedObject,
    type ImageObject,
    type LocalDefinedObject,
    type Position,
  } from "./canvas-store";
  import { throttle } from "lodash";

  type Props = {
    localObject: LocalDefinedObject;
    children: Snippet;
  };

  let { localObject, children }: Props = $props();

  const localPosition = localObject.localPosition;

  let isDragging = $state(false);
  let offsetX = 0;
  let offsetY = 0;

  let dragX = $state(0);
  let dragY = $state(0);

  const { x, y } = $derived(
    isDragging
      ? { x: dragX, y: dragY }
      : { x: $localPosition.x, y: $localPosition.y }
  );

  // Debounced function to update the position on the backend
  const moveObjectThrottled = throttle(async (immediate: boolean = false) => {
    try {
      await moveObject(
        {
          id: localObject.id,
          position: { x: dragX, y: dragY },
        },
        immediate
      );
    } catch (error) {
      console.error("failed to update position", error);
    }
  }, 100);

  // Start dragging
  const startDrag = (event: MouseEvent) => {
    event.preventDefault();
    offsetX = event.clientX - $localPosition.x;
    offsetY = event.clientY - $localPosition.y;

    isDragging = true;

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  // During dragging
  const onDrag = (event: MouseEvent) => {
    if (isDragging) {
      dragX = event.clientX - offsetX;
      dragY = event.clientY - offsetY;
      moveObjectThrottled();
    }
  };

  // Stop dragging
  const stopDrag = () => {
    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);

    moveObjectThrottled.cancel();
    moveObjectThrottled(true);
  };

  $effect(() => {});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="cursor:pointer;position: absolute; left: {x}px; top: {y}px;"
  onmousedown={startDrag}
>
  {@render children()}
</div>
