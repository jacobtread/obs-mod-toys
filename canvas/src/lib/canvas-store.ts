export type Uuid = string;

export enum ObjectServerActionType {
  CreateObject = "CreateObject",
  MoveObject = "MoveObject",
  RemoveObject = "RemoveObject",
  ClearObjects = "ClearObjects",
}

export type Position = {
  x: number;
  y: number;
};

export type ObjectServerAction =
  | ({
      type: ObjectServerActionType.CreateObject;
    } & ObjectServerActionCreateObject)
  | ({
      type: ObjectServerActionType.MoveObject;
    } & ObjectServerActionMoveObject)
  | ({
      type: ObjectServerActionType.RemoveObject;
    } & ObjectServerActionRemoveObject)
  | { type: ObjectServerActionType.ClearObjects };

export type ObjectServerActionCreateObject = {
  id: Uuid;
  object: Object;
  initial_position: Position;
};

export type ObjectServerActionMoveObject = {
  id: Uuid;
  position: Position;
};

export type ObjectServerActionRemoveObject = {
  id: Uuid;
};

export enum ObjectType {
  Text = "Text",
  Image = "Image",
}

export type Object =
  | ({ type: ObjectType.Text } & TextObject)
  | ({ type: ObjectType.Image } & ImageObject);

export type TextObject = { text: string };

export type ImageObject = { data: string };

export type DefinedObject = {
  position: Position;
  object: Object;
};

export type DefinedObjectWithId = {
  id: Uuid;
  object: DefinedObject;
};

export enum ClientMessageType {
  Authenticate = "Authenticate",
  ServerAction = "ServerAction",
}

export type ClientMessageAuthenticate = {
  username: string;
  password: string;
};

export type ClientMessageServerAction = {
  action: ObjectServerAction;
};

export type ClientMessage =
  | ({
      type: ClientMessageType.ServerAction;
    } & ClientMessageServerAction)
  | ({ type: ClientMessageType.Authenticate } & ClientMessageAuthenticate);

export enum ServerMessageType {
  Authenticated = "Authenticated",
  Error = "Error",
  ServerActionReported = "ServerActionReported",
  Objects = "Objects",
}

export type ServerMessageAuthenticated = {};
export type ServerMessageError = { message: string };
export type ServerMessageServerActionReported = { action: ObjectServerAction };
export type ServerMessageObjects = { objects: DefinedObjectWithId[] };

export type ServerMessage =
  | ({ type: ServerMessageType.Authenticated } & ServerMessageAuthenticated)
  | ({ type: ServerMessageType.Error } & ServerMessageError)
  | ({
      type: ServerMessageType.ServerActionReported;
    } & ServerMessageServerActionReported)
  | ({ type: ServerMessageType.Objects } & ServerMessageObjects);

type CanvasState = {
  objects: DefinedObjectWithId[];
};

export const canvasState: CanvasState = $state({
  objects: [],
});

let socketStore = $state<WebSocket | null>(null);

function createWebsocket(): WebSocket {
  const socket = new WebSocket("http://localhost:3000");
  socket.onmessage = (ev: MessageEvent) => {
    handleSocketMessage(socket, ev);
  };

  socket.onclose = () => {
    socketStore = null;
  };

  return socket;
}
try {
  socketStore = createWebsocket();
} catch (e) {
  console.log("failed to create socket", e);
}

async function sendSocketMessage(msg: ServerMessage) {
  if (socketStore === null) return;
  const data = JSON.stringify(msg);
  await socketStore.send(data);
}

function handleSocketMessage(
  socket: WebSocket,
  ev: MessageEvent<string | Blob>
) {
  const data = ev.data;

  // Cannot handle blob messages
  if (typeof data !== "string") return;

  try {
    const parsed: ServerMessage = JSON.parse(data);
  } catch (e) {
    console.error("failed to parse message", e);
  }
}
