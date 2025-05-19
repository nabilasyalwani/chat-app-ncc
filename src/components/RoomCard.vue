<script setup>
import { ref, watch } from "vue";
import { Globe } from "lucide-vue-next";
import { selectedRoom } from "../stores/GlobalVar.js";

const props = defineProps({
  id: Number,
  name: String,
  isPublic: Boolean,
  users: Object,
});

function selectRoom() {
  selectedRoom.value = { ...props };
}
</script>

<template>
  <button class="room" @click="selectRoom">
    <Globe v-if="isPublic"></Globe>
  </button>
</template>

<style scoped>
.room {
  background-color: #7e82d7;
  color: #121212;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.room:hover {
  box-shadow: 0 0 5px 1px #454cc6;
  transition: all 0.3s ease;
  transform: scale(1.05);
}
</style>
