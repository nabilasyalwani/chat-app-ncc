import { Context } from "@oak/oak";

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

  constructor() {
    const publicRoom: RoomType = {
      name: "Public Room",
      isPublic: true,
      users: [],
    };
    this.chatRooms.set(0, publicRoom);
  }

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
}
