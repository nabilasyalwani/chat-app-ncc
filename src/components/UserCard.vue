<script setup>
import { ref, watch } from "vue";
defineProps({
  username: String,
});
</script>

<template>
  <div class="user-card">
    <p>{{ username }}</p>
  </div>
</template>

<style scoped>
.user-card {
  background-color: #7e82d7;
  border: none;
  border-radius: 5px;
  height: 30px;
  padding: 5px 20px;
  display: flex;
  justify-content: flex-start;
  align-items: center;

  & p {
    color: black;
  }
}

.user-card:hover {
  box-shadow: 0 0 5px 1px #454cc6;
  transition: all 0.3s ease;
}
</style>
