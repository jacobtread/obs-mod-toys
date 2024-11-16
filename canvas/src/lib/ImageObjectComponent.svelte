<script lang="ts">
  import { type ImageObject, type LocalDefinedObject } from "./canvas-store";
  import PositionedObject from "./PositionedObject.svelte";

  type Props = {
    localObject: LocalDefinedObject;
    imageObject: ImageObject;
  };

  let { localObject, imageObject }: Props = $props();
  const { width, height } = imageObject;
</script>

<PositionedObject {localObject}>
  <img
    src={imageObject.url}
    alt="User Content"
    style="width: {width}px; height: {height}px;"
  />
</PositionedObject>
