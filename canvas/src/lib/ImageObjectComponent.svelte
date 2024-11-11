<script lang="ts">
  import {
    moveObject,
    type DefinedObject,
    type ImageObject,
    type LocalDefinedObject,
    type Position,
  } from "./canvas-store";
  import { debounce } from "lodash";

  type Props = {
    localObject: LocalDefinedObject;
    imageObject: ImageObject;
  };

  let { localObject, imageObject }: Props = $props();

  const localPosition = localObject.localPosition;

  const { x: localX, y: localY } = $localPosition;

  const { width, height } = imageObject;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  let dragX = 0;
  let dragY = 0;

  const x = isDragging ? dragX : localX;
  const y = isDragging ? dragY : localX;

  // Debounced function to update the position on the backend
  const moveObjectDebounced = debounce(async () => {
    try {
      await moveObject({
        id: localObject.id,
        position: { x: dragX, y: dragY },
      });
    } catch (error) {
      console.error("failed to update position", error);
    }
  }, 200);

  // Start dragging
  const startDrag = (event: MouseEvent) => {
    isDragging = true;
    offsetX = event.clientX - x;
    offsetY = event.clientY - y;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  // During dragging
  const onDrag = (event: MouseEvent) => {
    if (isDragging) {
      dragX = event.clientX - offsetX;
      dragY = event.clientY - offsetY;
      // Call the debounced updatePosition function
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
    // Optionally update the position after drag is complete
    moveObjectDebounced.cancel(); // Cancel the debounced function if dragging stops
    moveObjectDebounced(); // Send the final position update
  };
</script>

<img
  src={imageObject.url}
  alt=""
  style="position: absolute; left: {x}px; top: {y}px; width: {width}px; height: {height}px;"
  onmousedown={startDrag}
/>
