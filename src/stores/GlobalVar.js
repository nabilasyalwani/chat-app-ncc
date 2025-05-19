import { ref } from "vue";

export const myUser = ref("");

export const publicUsers = ref([]);

export const selectedRoom = ref({
  id: 0,
  name: "Public Room",
  isPublic: true,
  users: publicUsers,
});

export const chatRooms = ref([selectedRoom.value]);
