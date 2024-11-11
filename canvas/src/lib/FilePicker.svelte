<script lang="ts">
  import type { EventHandler } from "svelte/elements";

  type Props = {
    onPickFile: (file: string) => void;
  };

  const { onPickFile }: Props = $props();

  // Handle file input change
  const handleFileChange: EventHandler<Event, HTMLInputElement> = (event) => {
    if (
      !event.target ||
      !(event.target instanceof HTMLInputElement) ||
      event.target.files === null
    )
      return;

    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64Url = reader.result;
        if (typeof base64Url !== "string") return;
        onPickFile(base64Url);
      };

      // Read the file as a data URL (base64)
      reader.readAsDataURL(selectedFile);
    }
  };
</script>

<input type="file" onchange={handleFileChange} />
