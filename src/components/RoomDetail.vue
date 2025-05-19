<script setup>
import { ref, watch, computed } from "vue";
import UserCard from "./UserCard.vue";
import { selectedRoom, publicUsers } from "../stores/GlobalVar.js";
</script>

<template>
  <div class="room-detail">
    <h2>{{ selectedRoom.name }}</h2>
    <h4 v-if="selectedRoom.isPublic">Users:</h4>
    <h4 v-else>Members:</h4>
    <div class="user-list">
      <UserCard
        v-for="user in selectedRoom.users"
        :key="user"
        :username="user" />
    </div>
  </div>
</template>

<style scoped>
.room-detail {
  border: 1px solid #232323;
  padding: 0 20px;
  border-top-left-radius: 15px;
  border-top-right-radius: 0px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0px;
}

.room-detail.dark {
  background-color: #121212;
}

.room-detail.light {
  background-color: #ffffff;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
