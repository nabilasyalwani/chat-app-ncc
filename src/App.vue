<script setup>
import Header from "./components/Header.vue";
import RoomList from "./components/RoomList.vue";
import RoomCard from "./components/RoomCard.vue";
import RoomDetail from "./components/RoomDetail.vue";
import ChatContent from "./components/ChatContent.vue";
import User from "./components/User.vue";
import UserCard from "./components/User.vue";
</script>

<template>
  <div class="wrapper">
    <Header></Header>
    <div class="content">
      <RoomList class="room-list" />
      <RoomDetail class="room-detail" />
      <ChatContent class="chat-content" />
    </div>
    <User class="users"></User>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.room-list {
  width: 50px;
  flex-shrink: 0;
  overflow: auto;
}

.room-detail {
  width: 300px;
  flex-shrink: 0;
  overflow: auto;
}

.chat-content {
  flex: 1;
  overflow: auto;
}

.users {
  position: absolute;
  bottom: 0;
  left: 0;
  margin: 10px 20px;
}

p {
  font-size: medium;
}
</style>
