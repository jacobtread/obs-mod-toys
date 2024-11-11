<script lang="ts">
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
    imageObject: ImageObject;
  };

  let { localObject, imageObject }: Props = $props();

  const localPosition = localObject.localPosition;

  const { width, height } = imageObject;

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
  const moveObjectDebounced = throttle(async () => {
    try {
      await moveObject({
        id: localObject.id,
        position: { x: dragX, y: dragY },
      });
    } catch (error) {
      console.error("failed to update position", error);
    }
  }, 100);

  // Start dragging
  const startDrag = (event: MouseEvent) => {
    event.preventDefault();
    offsetX = event.clientX - x;
    offsetY = event.clientY - y;

    isDragging = true;

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  // During dragging
  const onDrag = (event: MouseEvent) => {
    if (isDragging) {
      dragX = event.clientX - offsetX;
      dragY = event.clientY - offsetY;
      moveObjectDebounced();
    }
  };

  // Stop dragging
  const stopDrag = () => {
    // Update the tweened position immediately
    localPosition.set({ x: dragX, y: dragY }, { delay: 0, duration: 0 });

    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);

    moveObjectDebounced.cancel();
    moveObjectDebounced();
  };

  $effect(() => {});
</script>

<img
  src={imageObject.url}
  alt=""
  style="cursor:pointer;position: absolute; left: {x}px; top: {y}px; width: {width}px; height: {height}px;"
  onmousedown={startDrag}
/>
