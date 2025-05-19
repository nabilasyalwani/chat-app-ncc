<script setup>
import { ref, onMounted, watch } from "vue";
import { ChartColumnBig } from "lucide-vue-next";
import { initSocket, getSocket } from "../socket.js";
import Polling from "./Polling.vue";
import {
  publicUsers,
  chatRooms,
  selectedRoom,
  myUser,
} from "../stores/GlobalVar.js";

const myUsername = prompt("Enter your name") || "Anonymous";
const socket = initSocket(myUsername);
const passwordInput = ref("");
const passwordError = ref(false);
const isAuthenticated = ref(false);
const messages = ref([]);
const inputRef = ref(null);
const formRef = ref(null);
const messageInput = ref("");
const hasChooseAnswer = ref({});
const pollingResult = ref({});
let updated = ref({});
let makePolling = ref(false);
myUser.value = myUsername;

watch(selectedRoom, (newRoom) => {
  if (newRoom && !newRoom.isPublic && !isMember()) {
    return;
  }

  if (newRoom && newRoom.id !== undefined) {
    updateRoomMessages(newRoom.id);
  }
});

socket.onopen = () => console.log("WebSocket opened");
socket.onclose = (e) => console.log("WebSocket closed", e);
socket.onerror = (e) => console.log("WebSocket error", e);

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.event) {
    case "update-users":
      publicUsers.value = data.usernames;
      break;

    case "send-message":
      addMessage(data.username, data.message);
      break;

    case "update-chat-rooms":
      chatRooms.value = data.chatRooms.map(({ id, room }) => ({ id, ...room }));
      updated.value = chatRooms.value.find(
        (r) => r.id === selectedRoom.value.id
      );
      selectedRoom.value = { ...updated.value };
      break;

    case "auth-success":
      isAuthenticated.value = true;
      passwordError.value = false;
      break;

    case "auth-failed":
      passwordError.value = true;
      break;

    case "room-messages":
      console.log("Received room-messages", data);
      messages.value = data.messages;
      const pollingMessages = messages.value.filter(
        (msg) => msg.isPolling && msg.pollId
      );
      pollingMessages.forEach((msg) => {
        if (!pollingResult.value[msg.pollId]) {
          pollingResult.value[msg.pollId] = {
            percentages: msg.percentages,
            totalVotes: msg.totalVotes,
            answerCounts: msg.answerCounts,
            answers: msg.answers,
            duration: msg.duration * 60,
            startTime: msg.startTime,
          };
        }
      });
      break;

    case "error":
      console.error("Error:", data.message);
      break;

    case "create-polling":
      messages.value.push({
        isPolling: true,
        ...data,
      });
      makePolling.value = false;
      pollingResult.value[data.pollId] = {
        percentages: {},
        totalVotes: 0,
        answerCounts: {},
        answers: data.answers,
        duration: data.duration * 60,
        startTime: data.startTime,
      };
      break;

    case "vote-polling":
      if (pollingResult.value[data.pollId]) {
        pollingResult.value[data.pollId].percentages = data.percentages;
        pollingResult.value[data.pollId].totalVotes = data.totalVotes;
        pollingResult.value[data.pollId].answerCounts = data.answerCounts;
      }
      break;

    case "polling-ended":
      if (pollingResult.value[data.pollId]) {
        pollingResult.value[data.pollId].duration = 0;
      }
      break;
  }

  console.log("WebSocket message", event.data);
};

function createPolling() {
  makePolling.value = true;
}

function updateRoomMessages(id) {
  getSocket().send(
    JSON.stringify({
      event: "get-messages",
      roomId: selectedRoom.value.id,
    })
  );
}

function addMessage(username, message) {
  messages.value.push({ username, message });
}

function isMember() {
  return selectedRoom.value && selectedRoom.value.users.includes(myUser.value);
}
function allowedSendMessage() {
  if (!selectedRoom.value) return false;
  if (selectedRoom.value.isPublic) return true;
  return isMember();
}

function submitPassword() {
  getSocket().send(
    JSON.stringify({
      event: "auth-room",
      roomId: selectedRoom.value.id,
      password: passwordInput.value,
    })
  );
  passwordInput.value = "";
}

function sendMessage() {
  const message = messageInput.value;
  messageInput.value = "";
  if (!message) return;
  getSocket().send(
    JSON.stringify({
      event: "send-message",
      message: message,
      roomId: selectedRoom.value.id,
    })
  );
}

function chooseAnswer(answer, pollId) {
  if (
    pollingResult.value[pollId].duration <= 0 ||
    hasChooseAnswer.value[pollId]
  )
    return;
  hasChooseAnswer.value[pollId] = true;
  getSocket().send(
    JSON.stringify({
      event: "vote-polling",
      pollId: pollId,
      answer: answer,
      roomId: selectedRoom.value.id,
    })
  );
}

function getDurationText(pollId) {
  const poll = pollingResult.value[pollId];
  if (!poll || !poll.startTime) return "0 seconds";
  const now = Date.now();
  const elapsed = Math.floor((now - poll.startTime) / 1000);
  const remaining = Math.max(0, (poll.duration || 0) - elapsed);

  if (remaining <= 0) {
    hasChooseAnswer.value[pollId] = true;
    poll.duration = 0;
    return "Polling ended";
  }

  if (remaining >= 3600) {
    return `${Math.floor(remaining / 3600)} hours`;
  } else if (remaining >= 60) {
    return `${Math.floor(remaining / 60)} minutes`;
  } else {
    return `${remaining} seconds`;
  }
}

onMounted(() => {
  watch(
    () => allowedSendMessage(),
    (canSend) => {
      if (canSend && inputRef.value) {
        inputRef.value.focus();
      }
    },
    { immediate: true }
  );
});

const timer = ref(Date.now());
onMounted(() => {
  setInterval(() => {
    timer.value = Date.now();
  }, 1000);
});
</script>

<template>
  <div class="chat-content">
    <div id="conversation">
      <div
        class="chat-message"
        v-if="allowedSendMessage()"
        v-for="(msg, idx) in messages.slice().reverse()"
        :key="idx">
        <div v-if="msg.isPolling">
          <span>{{ msg.username }}</span>
          <div class="polling-message dark">
            <p>{{ msg.question }}</p>
            <div v-if="pollingResult[msg.pollId]">
              <ul class="polling-answers">
                <li
                  class="polling-row"
                  v-for="(ans, i) in pollingResult[msg.pollId]?.answers || []"
                  :key="i">
                  <template v-if="hasChooseAnswer[msg.pollId]">
                    <span>{{ ans }}</span>
                    <section class="polling-percentage">
                      <span>
                        {{
                          pollingResult[msg.pollId]?.percentages?.[
                            ans
                          ]?.toFixed(1) || 0
                        }}%
                      </span>
                      <span>
                        ({{
                          pollingResult[msg.pollId]?.answerCounts?.[ans] || 0
                        }}
                        vote)
                      </span>
                    </section>
                  </template>
                  <template v-else>
                    <span
                      class="polling-btn"
                      @click="chooseAnswer(ans, msg.pollId)"
                      :disabled="
                        hasChooseAnswer[msg.pollId] ||
                        pollingResult[msg.pollId]?.duration <= 0
                      ">
                      {{ ans }}
                    </span>
                  </template>
                </li>
              </ul>
            </div>
            <div class="polling-info">
              <p>
                Voted:
                {{ pollingResult[msg.pollId]?.totalVotes || 0 }}
                users
              </p>
              <p>Duration: {{ getDurationText(msg.pollId) }}</p>
              <span style="display: none">{{ timer }}</span>
            </div>
          </div>
        </div>
        <div v-else>
          <span>{{ msg.username }}</span>
          <p>{{ msg.message }}</p>
        </div>
      </div>
    </div>
    <form
      v-if="allowedSendMessage()"
      @submit.prevent="sendMessage"
      ref="formRef">
      <button type="button" class="button-polling" @click="createPolling">
        <ChartColumnBig size="20" />
      </button>
      <div v-if="makePolling">
        <div class="overlay" @click="makePolling = false"></div>
        <Polling></Polling>
      </div>
      <input
        type="text"
        v-model="messageInput"
        ref="inputRef"
        placeholder="send message"
        autocomplete="off" />
      <button type="submit" id="send">Send</button>
    </form>
    <div v-else>
      <form @submit.prevent="submitPassword">
        <input
          type="password"
          v-model="passwordInput"
          :placeholder="
            passwordError ? 'password salah!' : 'enter room password'
          " />
        <button type="submit">Enter</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-content {
  border: 1px solid #232323;
  border-top-left-radius: 0px;
  border-top-right-radius: 15px;
  border-bottom-right-radius: 0px;
  border-bottom-left-radius: 0px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

#conversation {
  flex: 1;
  display: flex;
  flex-direction: column-reverse;
  overflow-y: auto;
  padding: 0.5rem;
  border-radius: 0.5rem;

  & .chat-message {
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;

    & p {
      margin: 0;
    }

    & span {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }

    & .polling-message {
      padding: 1rem;
      border-radius: 0.5rem;
      width: 400px;
      border: 1px solid rgba(159, 159, 159, 0.3);
    }

    & .polling-answers {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 0.5rem;
      gap: 0.5rem;
      background-color: #7e82d7;
      border-radius: 0.5rem;
      color: #232323;
      list-style: none;
    }

    & .polling-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background-color: #f0f0f0;
    }

    & .polling-percentage {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    & .polling-btn {
      padding: 0.5rem;
      cursor: pointer;
      width: 100%;
    }
  }

  & .chat-message:hover {
    translate: 0 -0.1rem;
    transition: all 0.3s ease;
  }
}

form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 50px;
  padding: 0.75rem;
}

input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #232323;
  border-radius: 0.5rem;
  font-size: medium;
  font-family: system-ui;
}

input:focus {
  outline: none;
  border: 2px solid #7e82d7;
  box-shadow: 0 0 0 2px rgba(126, 130, 215, 0.3);

  & .password-error {
    border: 2px solid #ff0000;
    box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.3);
  }
}

button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background-color: #7e82d7;
  color: #0b0d11;
  cursor: pointer;
  font-family: system-ui;
  font-size: medium;
}

button:hover {
  box-shadow: 0 0 5px 1px #454cc6;
  transition: all 0.3s ease;
}

.button-polling {
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10;
}

.polling-info {
  display: flex;
  justify-content: space-between;
  font-size: small;
  color: #666;
}

.polling-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: small;
  color: #666;
}
</style>
