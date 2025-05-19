<script setup>
import { ref, watch } from "vue";
import RoomCard from "./RoomCard.vue";
import { Plus } from "lucide-vue-next";
import { chatRooms, myUser, selectedRoom } from "../stores/GlobalVar.js";
import { getSocket } from "../socket.js";

function createPrivateRoom() {
  const roomName = prompt("Please enter private room name") || "Private Room";
  const password =
    prompt("Please enter a password for this private room") || "";

  getSocket().send(
    JSON.stringify({
      event: "create-chat-room",
      name: roomName,
      isPublic: false,
      admin: myUser.value,
      password: password,
    })
  );

  console.log(`Created private room '${roomName}' by ${myUser.value}`);
}
</script>

<template>
  <div class="rooms">
    <div class="room-card">
      <RoomCard
        v-for="room in chatRooms"
        :key="room.id"
        :id="room.id"
        :name="room.name"
        :isPublic="room.isPublic"
        :users="room.users" />
      <button class="create-private-room" @click="createPrivateRoom">
        <Plus size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.rooms {
  padding: 12px 12px;
  padding-left: 24px;
}

.room-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create-private-room {
  background-color: transparent;
  border: 1px solid #232323;
  border-radius: 10px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.create-private-room:hover {
  box-shadow: 0 0 5px 1px #454cc6;
  transition: all 0.3s ease;
  transform: scale(1.05);
}
</style>
