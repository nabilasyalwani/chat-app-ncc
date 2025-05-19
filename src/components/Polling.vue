<script setup>
import { ref, watch } from "vue";
import { Globe, Plus, Trash2 } from "lucide-vue-next";
import { selectedRoom } from "../stores/GlobalVar.js";
import { getSocket } from "../socket.js";

const answersInput = ref(["", ""]);
const questionInput = ref("");
const durationInput = ref("");
const socket = getSocket();

function selectRoom() {
  selectedRoom.value = { ...props };
}

function createAnswerInput() {
  answersInput.value.push("");
}

function sendPolling() {
  if (questionInput.value === "") {
    return;
  }
  if (answersInput.value.length < 2) {
    return;
  }
  if (durationInput.value < 1 || durationInput.value > 1440) {
    return;
  }

  socket.send(
    JSON.stringify({
      event: "create-polling",
      roomId: selectedRoom.value.id,
      question: questionInput.value,
      answers: answersInput.value,
      duration: durationInput.value,
    })
  );

  console.log("Polling sent");
}
</script>

<template>
  <div class="poll-container">
    <h3>Create Polling</h3>
    <form class="poll-form" @submit.prevent="sendPolling">
      <label>Question</label>
      <input
        type="text"
        v-model="questionInput"
        autocomplete="off"
        placeholder="what question do you want to ask?" />
      <label>Answers</label>
      <div
        class="answer-section"
        v-for="(answer, idx) in answersInput"
        :key="idx">
        <input
          type="text"
          v-model="answersInput[idx]"
          autocomplete="off"
          placeholder="type your answer here" />
        <button
          v-if="answersInput.length > 2"
          class="drop"
          type="button"
          @click="answersInput.splice(idx, 1)">
          <Trash2 size="20" />
        </button>
      </div>
      <button
        type="button"
        class="create-answer-input"
        @click="createAnswerInput">
        <Plus size="20" />
      </button>
      <span></span>
      <label>Duration</label>
      <input
        type="number"
        v-model="durationInput"
        min="1"
        max="1440"
        autocomplete="off"
        placeholder="how long do you want it for? (in minute)" />
    </form>
    <button type="button" class="button-polling" @click="sendPolling">
      Post
    </button>
  </div>
</template>

<style scoped>
.poll-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #7e82d7;
  color: #121212;
  border: none;
  border-radius: 10px;
  width: 30%;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;

  & h3 {
    font-size: large;
    color: #121212;
    margin-bottom: 10px;
    padding-top: 10px;
  }
}

.poll-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  margin-bottom: 20px;
  width: 85%;

  & input {
    padding: 10px 20px;
    border-radius: 5px;
    border: none;
    background-color: #f0f0f0;
    color: #121212;
    font-size: small;
    font-family: system-ui;
  }

  & input:focus {
    outline: none;
    border: 2px solid #bdc1ff;
    box-shadow: 0 0 0 2px rgba(44, 48, 117, 0.385);
  }

  & input:hover {
    box-shadow: 0 0 5px 1px #454cc6;
    transition: all 0.3s ease;
    transform: scale(1.01);
  }

  & label {
    font-size: medium;
    color: #121212;
  }
}

button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border: none;
  cursor: pointer;
  font-family: system-ui;
  font-size: medium;
  width: 100%;
}

.button-polling {
  cursor: pointer;
  display: flex;
  justify-content: flex-end;
  padding-right: 30px;
}

.create-answer-input {
  border-radius: 5px;
  cursor: pointer;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.answer-section {
  display: flex;
  gap: 10px;
  width: 100%;

  & input {
    flex: 1;
  }
}

.drop {
  border: none;
  border-radius: 0.5rem;
  width: 50px;
  display: flex;
  justify-content: center;
  cursor: pointer;
}
</style>
