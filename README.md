# Chat App 

Implementasi websocket pada aplikasi chat berbasis website menggunakan `Deno` dan `Vue` sebagai final project open recruitment admin NCC 2025. 

# Setting Project
## Front End
**Vite + Vue**

Untuk tampilan depan (frontend), digunakan `Vite` dengan framework `Vue.js` untuk mempermudah dan mempercepat pengembangan aplikasi chat. `Vue.js` membagi setiap komponen menjadi tiga bagian utama: template, script, dan style. Template mendefinisikan tampilan komponen, script berisi logika dan data komponen, dan style menentukan gaya CSS komponen.

Adapun command yang digunakan untuk membuat vite adalah berikut:

```
npm create vite@latest

◇  Project name:
│  chat-app
│
◇  Select a framework:
│  Vue
│
◇  Select a variant:
│  JavaScript
```

Kemudian, dijalankan command berikut:
```
cd chat-app
npm install
```


## Back End

**Deno**

`Deno` adalah javascript runtime untuk membuat sebuah web tetapi dengan keamanan yang lebih baik dibandingkan `Node.js` serta dependency-nya bisa diakses secara online sehingga tidak perlu menglola `package.lock.json`

Langkah pertama, melakukan instalisasi `Deno` pada perangkat:
```
irm https://deno.land/install.ps1 | iex
```
Selanjutnya, dilakukan setup pada project aplikasi chat dengan command berikut:
```
cd chat-app
deno init
deno add jsr:@oak/oak
```


# Penjelasan Server
## main.ts

File `main.ts` berfungsi sebagai penyedia endpoint koneksi untuk chat-app dan penghubung antara `ChatServer.ts` dengan client `ChatContent.vue` di komponen frontend.

```
import { Application, Context, Router } from "@oak/oak";
import ChatServer from "./ChatServer.ts";

const app = new Application();
const port = 8000;
const router = new Router();
const server = new ChatServer();

router.get("/start_web_socket", (ctx: Context) => server.handleConnection(ctx));

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  ctx.response.headers.set("Access-Control-Allow-Headers", "*");
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
});

console.log("Listening at http://localhost:" + port);
await app.listen({ hostname: "0.0.0.0", port });
```

- Baris ke 9 merupakan endpoint yang akan menangani websocket dengan memanggil `handleConnection` di `ChatServer.ts`
- Baris ke 14 hingga 26 mengatur izin `CORS (Cross-Origin Resource Sharing)` pada server agar bisa menerima request dari domain mana saja, mengizinkan metode HTTP GET, POST, dan OPTIONS, serta mengizinkan semua header pada request.


## ChatServer.ts

Pada `ChatServer.ts`, dilakukan pengaturan `handleConnection` untuk client yang connect ke server. File ini juga memuat kode untuk mengelola room, pesan chat, dan polling secara real time. Semua data dikelola di memori server dan dibroadcast ke client sesuai event yang terjadi.

**Tipe data dan variabel kelas**

```
type WebSocketWithUsername = WebSocket & { username: string | null };
type AppEvent = { event: string; [key: string]: unknown };
type RoomType = {
  name: string;
  isPublic: boolean;
  users: string[];
  password?: string;
};
type MessageType = {
  username: string;
  message?: string;
  question?: string;
  answers?: string[];
  pollId?: number;
  duration?: number;
  startTime?: number;
  isPolling?: boolean;
  percentages?: Record<string, number>;
  totalVotes?: number;
  answerCounts?: Record<string, number>;
};

export default class ChatServer {
  private connectedClients = new Map<string, WebSocketWithUsername>();
  private chatRooms = new Map<number, RoomType>();
  private roomMessages = new Map<number, MessageType[]>();
  private pollVotes = new Map<number, Map<string, string>>();
  private roomIdCounter = 1;

  ...
}
```
- Untuk tipe data message, pesan biasa dan polling digabung agar tetap terintegrasi ketika dipanggil kembali oleh client.

**Constructor**

Ketika kelas ChatServer diinisialisasi, public room juga otomatis dimasukkan ke dalam variabel chat room.
```
constructor() {
  const publicRoom: RoomType = {
    name: "Public Room",
    isPublic: true,
    users: [],
  };
  this.chatRooms.set(0, publicRoom);
}
```

**Handle Connection**

Fungsi ini menangani koneksi websocket baru, melakukan validasi user, melakukan setup event handler, memasukkan user ke public room, dan menyimpan socket ke server.
```
public async handleConnection(ctx: Context) {
  console.log("Upgrading to WebSocket...");
  const socket = (await ctx.upgrade()) as WebSocketWithUsername;
  console.log("WebSocket connection established");
  const username = ctx.request.url.searchParams.get("username");

  if (username == null) {
    socket.close(1008, "Username is empty");
    return;
  }

  if (this.connectedClients.has(username)) {
    socket.close(1008, `Username ${username} is already taken`);
    return;
  }

  socket.username = username;
  socket.onopen = () => {
    this.broadcastUsernames();
    this.broadcastChatRooms();
  };
  socket.onclose = () => {
    if (socket.username != null) {
      this.clientDisconnected(socket.username);
    }
  };
  socket.onmessage = (m) => {
    try {
      this.send(socket, m);
    } catch (error) {
      console.error("Error when handling message:", error);
    }
  };
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  this.connectedClients.set(username, socket);
  const publicRoom = this.chatRooms.get(0);
  if (publicRoom && !publicRoom.users.includes(username)) {
    publicRoom.users.push(username);
  }
  console.log(`New client connected: ${username}`);
}
```


**Send**

Fungsi untuk menangani semua event dari client.
```
private send(socket: WebSocketWithUsername, message: MessageEvent) {
  if (socket.username == null) {
    return;
  }

  const data = JSON.parse(message.data);

  switch (data.event) {
    case "send-message": {
      const { roomId } = data;
      const room = this.chatRooms.get(roomId);
      if (!room) return;

      if (room.isPublic || room.users.includes(socket.username)) {
        if (!this.roomMessages.has(roomId)) {
          this.roomMessages.set(roomId, []);
        }

        this.roomMessages.get(roomId)!.push({
          username: socket.username,
          message: data.message,
        });

        this.broadcastToRoom(roomId, {
          event: "send-message",
          username: socket.username,
          message: data.message,
          roomId,
        });
      }
      break;
    }

    case "auth-room": {
      const { roomId, password } = data;
      const room = this.chatRooms.get(roomId);
      if (!room || room.isPublic) return;

      if (room.password === password) {
        if (!room.users.includes(socket.username)) {
          room.users.push(socket.username);
        }
        socket.send(JSON.stringify({ event: "auth-success", roomId }));
        this.broadcastChatRooms();
      } else {
        socket.send(JSON.stringify({ event: "auth-failed", roomId }));
      }
      break;
    }

    case "create-chat-room": {
      this.createChatRoom(
        data.name,
        data.isPublic,
        socket.username,
        data.password
      );
      break;
    }

    case "get-messages": {
      const { roomId } = data;
      const messages = this.roomMessages.get(roomId) ?? [];
      console.log(
        `Sending room-messages for roomId ${roomId} to ${socket.username}`
      );
      socket.send(
        JSON.stringify({
          event: "room-messages",
          roomId,
          messages,
        })
      );
      break;
    }

    case "current-room": {
      this.broadcastChatRooms();
      break;
    }

    case "create-polling": {
      const { roomId, question, answers, duration } = data;
      const room = this.chatRooms.get(roomId);
      const pollId = Math.floor(Math.random() * 1000000);
      if (!room) return;

      if (room.isPublic || room.users.includes(socket.username)) {
        if (!this.roomMessages.has(roomId)) {
          this.roomMessages.set(roomId, []);
        }

        const startTime = Date.now();

        this.roomMessages.get(roomId)!.push({
          username: socket.username,
          isPolling: true,
          question,
          answers,
          pollId,
          duration,
          startTime,
        });

        this.broadcastToRoom(roomId, {
          event: "create-polling",
          question,
          answers,
          pollId,
          duration,
          startTime,
          username: socket.username,
        });

        setTimeout(() => {
          this.broadcastToRoom(roomId, { event: "polling-ended", pollId });
        }, duration * 60 * 1000);
      }
      break;
    }

    case "vote-polling": {
      const { roomId, pollId, answer } = data;
      const room = this.chatRooms.get(roomId);
      if (!room) return;

      if (!this.pollVotes.has(pollId)) {
        this.pollVotes.set(pollId, new Map());
      }

      this.pollVotes.get(pollId)!.set(socket.username, answer);

      const votes = Array.from(this.pollVotes.get(pollId)!.values());
      const totalVotes = votes.length;
      const answerCounts: Record<string, number> = {};
      votes.forEach((ans) => {
        answerCounts[ans] = (answerCounts[ans] || 0) + 1;
      });
      const percentages: Record<string, number> = {};
      for (const ans in answerCounts) {
        percentages[ans] = (answerCounts[ans] / totalVotes) * 100;
      }

      if (!this.roomMessages.has(roomId)) {
        this.roomMessages.set(roomId, []);
      }

      const pollMsg = this.roomMessages
        .get(roomId)!
        .find((msg) => msg.isPolling && msg.pollId === pollId);
      if (pollMsg) {
        pollMsg.percentages = percentages;
        pollMsg.totalVotes = totalVotes;
        pollMsg.answerCounts = answerCounts;
      }
      
      this.broadcastToRoom(roomId, {
        event: "vote-polling",
        pollId,
        percentages,
        totalVotes,
        answerCounts,
        username: socket.username,
      });
      break;
    }

    default:
      break;
  }
  console.log("data:", data);
}
```
Fungsi ini merupakan handler utama untuk semua event dari client, seperti:
- `send-message`: mengirim pesan chat ke room.
- `auth-room`: autentikasi masuk private room.
- `create-chat-room`: membuat room baru.
- `get-messages`: mengirim semua pesan di room ke client.
- `current-room`: mengirim informasi room chat yang tersedia.
- `create-polling`: membuat polling baru di room.
- `vote-polling`: menyimpan dan mengupdate hasil voting polling.


**Client Disconnected**

Fungsi untuk menangani ketika client disconnected dari server.
```
private clientDisconnected(username: string) {
  this.connectedClients.delete(username);

  for (const [roomId, room] of this.chatRooms.entries()) {
    room.users = room.users.filter((user) => user !== username);

    if (room.users.length === 0 && !room.isPublic) {
      this.chatRooms.delete(roomId);
      this.roomMessages.delete(roomId);
      console.log(`Room '${room.name}' deleted`);
    }
  }

  if (this.connectedClients.size === 0) {
    this.chatRooms.set(0, {
      name: "Public Room",
      isPublic: true,
      users: [],
    });
    this.roomMessages.delete(0);
    console.log(`Public room deleted`);
  }

  this.broadcastUsernames();
  this.broadcastChatRooms();
  console.log(`Client ${username} disconnected`);
}
```


**Create Chat Room**

Fungsi untuk membuat private room 
```
private createChatRoom(
  name: string,
  isPublic: boolean,
  admin: string,
  password?: string
) {
  const id = this.roomIdCounter++;
  const newRoom: RoomType = { name, isPublic, users: [], password };
  if (!newRoom.users.includes(admin)) {
    newRoom.users.push(admin);
  }
  this.chatRooms.set(id, newRoom);
  this.broadcastChatRooms();

  console.log(`Created room '${name}' by ${admin}`);
}
```


**Broadcast**

```
private broadcastUsernames() {
  const usernames = [...this.connectedClients.keys()];
  this.broadcast({ event: "update-users", usernames });

  console.log("Sent username list:", JSON.stringify(usernames));
}

private broadcastChatRooms() {
  const chatRooms = [...this.chatRooms.entries()].map(([id, room]) => ({
    id,
    room,
  }));
  this.broadcast({ event: "update-chat-rooms", chatRooms });
  console.log("Sent rooms list:", JSON.stringify(chatRooms));
}

private broadcast(message: AppEvent) {
  const messageString = JSON.stringify(message);
  for (const client of this.connectedClients.values()) {
    if (client.username == null || client.readyState !== WebSocket.OPEN) {
      continue;
    }

    try {
      client.send(messageString);
    } catch (error) {
      console.error("Error when broadcasting message:", error);
    }
  }
}

private broadcastToRoom(roomId: number, message: AppEvent) {
  const room = this.chatRooms.get(roomId);
  if (!room) return;
  const messageString = JSON.stringify(message);
  for (const username of room.users) {
    const client = this.connectedClients.get(username);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        console.log(`Broadcasting to ${username} in room ${roomId}`);
        client.send(messageString);
      } catch (error) {
        console.error("Error when broadcasting to room:", error);
      }
    } else {
      console.warn(`Client ${username} not connected or not open`);
    }
  }
}
```
- `Broadcast`: mengirim pesan/event ke semua user di semua room.
- `BroadcastToRoom`: mengirim pesan/event ke semua user di room tertentu. 


# Komponen Front End
![image](https://github.com/user-attachments/assets/ebf3a2f5-a908-43c8-865d-d52ba1e18dc0)

- `App.vue`: komponen root aplikasi chat.
- `ChatContent.vue`: komponen utama chat, menampilkan pesan, polling, dan menangani interaksi voting.
- `Polling.vue`: form untuk membaut polling baru (pertanyaan, jawaban, durasi).
- `RoomList.vue`: komponen untuk menampilkan daftar room, terdiri atas beberapa komponen roomcard.
- `RoomCard.vue`: komponen untuk setiap room.
- `RoomDetail.vue`: komponen untuk menampilkan detail room, termasuk nama room dan users/members.
- `User.vue`: komponen untuk setiap user.
- `UserCard.vue`: komponen untuk menampilkan informasi mengenai client (user).
- `Header.vue`: komponen untuk header aplikasi chat yang memuat logo dan icon switch mode.


# Penjelasan Client

Fungsi yang menangani client pada aplikasi chat ini berada pada file `ChatContent.vue`.

## ChatContent.vue

**Import library dan variabel**

```
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
```

**Fungsi watch**

Fungsi ini dijalankan setiap variabel selectedRoom berubah atau jika user berpindah room.

```
watch(selectedRoom, (newRoom) => {
  if (newRoom && !newRoom.isPublic && !isMember()) {
    return;
  }

  if (newRoom && newRoom.id !== undefined) {
    updateRoomMessages(newRoom.id);
  }
});
```


**Websocket Event Handler**

```
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
```
- `update-users`: melakukan update pada daftar user.
- `send-message`: menambah pesan ke chat.
- `update-chat-rooms`: melakukan update pada daftar room.
- `auth-success/auth-failed`: menangani login room privat.
- `room-messages`: melakukan update pada semua pesan & polling di room.
- `create-polling`: menambah polling baru ke chat & pollingResult.
- `vote-polling`: melakukan update pada hasil polling di pollingResult.
- `polling-ended`: set durasi polling jadi 0 (habis).

**Fungsi Fungsi**

```
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
```

- `createPolling`: menampilkan form polling.
- `updateRoomMessages`: melakukan request pesan room ke server.
- `addMessage`: menambah pesan ke array.
- `isMember`, `allowedSendMessage`: mengecek akses kirim pesan.
- `submitPassword`: mengirim password private room.
- `sendMessage`: mengirim pesan chat ke server.
- `chooseAnswer`: mengirim vote polling ke server, hanya jika belum vote & waktu masih ada.
- `getDurationText`: menghitung dan menampilkan sisa waktu polling secara real-time.

**OuMounted**

```
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
```
- Memastikan input chat otomatis fokus saat user bisa mengirim pesan.
- Membuat timer agar countdown polling selalu update di tampilan.


# Tampilan chat app

![Screenshot (802)](https://github.com/user-attachments/assets/52d9890f-efc5-4e03-8476-c4c7bee76dca)

![Screenshot (803)](https://github.com/user-attachments/assets/6d0869af-d499-4d23-9b76-94761347a2cd)

![Screenshot (804)](https://github.com/user-attachments/assets/f4f9e9fc-d3cd-4ba3-b6b9-fa76626a8e31)

![Screenshot (805)](https://github.com/user-attachments/assets/ea7af982-5673-427f-a2a5-fe2c47ea9bf1)

![Screenshot (806)](https://github.com/user-attachments/assets/00297e02-8348-42a7-ac53-9da30a260b6d)

![Screenshot (807)](https://github.com/user-attachments/assets/9859c7e8-809b-41a8-9db6-5e13c0fb5c17)

![Screenshot (808)](https://github.com/user-attachments/assets/be3fdafa-db0c-490b-b63d-a48fc6088564)

Made with love by: Andi Nur Nabila Syalwani







