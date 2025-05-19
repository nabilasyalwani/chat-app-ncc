let socket = null;

export function initSocket(username) {
  const url = new URL(
    `http://localhost:8080/start_web_socket?username=${username}`,
    location.href
  );
  url.protocol = url.protocol.replace("http", "ws");

  socket = new WebSocket(url);

  return socket;
}

export function getSocket() {
  return socket;
}
