<script lang="ts">
  import { type LocalDefinedObject, type TextObject } from "./canvas-store";
  import PositionedObject from "./PositionedObject.svelte";

  type Props = {
    localObject: LocalDefinedObject;
    textObject: TextObject;
  };

  let { localObject, textObject }: Props = $props();
  const { text } = textObject;
</script>

<PositionedObject {localObject}>
  <p>{text}</p>
</PositionedObject>
