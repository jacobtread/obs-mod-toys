<script lang="ts">
  import { clearObjects, createObject, ObjectType } from "./canvas-store";
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

  const onClear = () => {
    clearObjects();
  };
</script>

<button onclick={onClear}>Clear</button>
<FilePicker {onPickFile} />
