<script setup>
import { ref, watch } from "vue";
import UserCard from "./UserCard.vue";
import { myUser } from "../stores/GlobalVar.js";
</script>

<template>
  <div class="user-info">
    <h4>Username:</h4>
    <p>{{ myUser }}</p>
  </div>
</template>

<style scoped>
.user-info {
  border: 1px solid #232323;
  padding: 10px 20px;
  width: 350px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;

  & h4 {
    margin-right: 8px;
  }
}

.user-info:hover {
  box-shadow: 0 0 5px 1px #454cc6;
  transition: all 0.3s ease;
}
</style>
