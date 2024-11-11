<script lang="ts">
  import { removeObject, type LocalDefinedObject } from "./canvas-store";

  type Props = {
    objects: LocalDefinedObject[];
  };

  const { objects }: Props = $props();

  const onRemove = (object: LocalDefinedObject) => {
    removeObject({
      id: object.id,
    });
  };
</script>

<ul class="object-list">
  {#each objects as object (object.id)}
    <li class="object-list-item">
      <div class="object">
        <p class="object__name">{object.object.type}</p>
        <p class="object__id">{object.id}</p>
        <p class="object__pos">
          X: {object.remotePosition.x} Y: {object.remotePosition.y}
        </p>
        <button onclick={() => onRemove(object)}>Remove</button>
      </div>
    </li>
  {/each}
</ul>

<style>
  .object-list {
    position: absolute;
    right: 0;
    top: 0;
    width: 100px;
    height: 100vh;
    z-index: 99;
  }

  .object-list-item {
  }

  .object {
  }

  .object__name {
  }

  .object__id {
  }
  .object__pos {
  }
</style>
