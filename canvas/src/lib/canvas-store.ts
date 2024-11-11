import { tweened, type Tweened } from "svelte/motion";

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

export type ImageObject = {
  url: string;
  width: number;
  height: number;
};

export type DefinedObject = {
  position: Position;
  object: Object;
};

export type LocalDefinedObject = {
  // ID of the object
  id: Uuid;
  // Remote screen position of the object
  remotePosition: Position;
  // Local tweened position of the object
  localPosition: Tweened<Position>;
  // The object itself
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
  objects: LocalDefinedObject[];
};

export let canvasState: CanvasState = $state({
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

  socket.onopen = () => {
    // TODO: Should actually happen in UI
    sendAuthenticate("", "");
  };

  return socket;
}
try {
  socketStore = createWebsocket();
} catch (e) {
  console.log("failed to create socket", e);
}

async function sendSocketMessage(msg: ClientMessage) {
  if (socketStore === null) return;
  const data = JSON.stringify(msg);
  await socketStore.send(data);
}

function sendAuthenticate(username: string, password: string) {
  return sendSocketMessage({
    type: ClientMessageType.Authenticate,
    username,
    password,
  });
}

export function sendServerAction(action: ObjectServerAction) {
  return sendSocketMessage({
    type: ClientMessageType.ServerAction,
    action,
  });
}

function handleActionReport(msg: ServerMessageServerActionReported) {
  switch (msg.action.type) {
    case ObjectServerActionType.CreateObject:
      createObjectLocal(
        msg.action.id,
        msg.action.object,
        msg.action.initial_position
      );
      break;
    case ObjectServerActionType.MoveObject:
      moveObjectLocal(msg.action);
      break;
    case ObjectServerActionType.RemoveObject:
      removeObjectLocal(msg.action);
      break;
    case ObjectServerActionType.ClearObjects:
      clearObjectsLocal();
      break;
  }
}

function handleAuthenticated(msg: ServerMessageAuthenticated) {
  console.log("Authenticated");
}

function handleServerError(msg: ServerMessageError) {
  console.error("error response", msg.message);
}

function handleObjects(msg: ServerMessageObjects) {
  canvasState.objects = msg.objects.map((object) => ({
    id: object.id,
    localPosition: tweened(object.object.position),
    object: object.object.object,
    remotePosition: object.object.position,
  }));
  canvasState = canvasState;
}

function randomUUID(): string {
  // TODO: Polyfill
  return self.crypto.randomUUID();
}

export function createObject(object: Object, initial_position: Position) {
  const id = randomUUID();

  sendServerAction({
    type: ObjectServerActionType.CreateObject,
    id,
    object,
    initial_position,
  });

  createObjectLocal(id, object, initial_position);
}
export function createObjectLocal(
  id: string,
  object: Object,
  initial_position: Position
) {
  canvasState.objects.push({
    id,
    object,
    remotePosition: initial_position,
    localPosition: tweened(initial_position),
  });
  canvasState = canvasState;
}

export function moveObject(data: ObjectServerActionMoveObject) {
  sendServerAction({
    type: ObjectServerActionType.MoveObject,
    id: data.id,
    position: data.position,
  });

  moveObjectLocal(data);
}

export function moveObjectLocal(data: ObjectServerActionMoveObject) {
  const objectIndex = canvasState.objects.findIndex(
    (object) => object.id == data.id
  );
  if (objectIndex === -1) return;

  const object = canvasState.objects[objectIndex];
  object.remotePosition = data.position;
  object.localPosition.set(data.position);
}

export function removeObject(data: ObjectServerActionRemoveObject) {
  sendServerAction({
    type: ObjectServerActionType.RemoveObject,
    id: data.id,
  });
  removeObjectLocal(data);
}
export function removeObjectLocal(data: ObjectServerActionRemoveObject) {
  canvasState.objects = canvasState.objects.filter(
    (object) => object.id !== data.id
  );
  canvasState = canvasState;
}

export function clearObjects() {
  sendServerAction({
    type: ObjectServerActionType.ClearObjects,
  });
  clearObjectsLocal();
}

export function clearObjectsLocal() {
  canvasState.objects = [];
  canvasState = canvasState;
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

    switch (parsed.type) {
      case ServerMessageType.Authenticated:
        handleAuthenticated(parsed);
        return;
      case ServerMessageType.Error:
        handleServerError(parsed);
        return;
      case ServerMessageType.ServerActionReported:
        handleActionReport(parsed);
        return;
      case ServerMessageType.Objects:
        handleObjects(parsed);
        return;
    }
  } catch (e) {
    console.error("failed to parse message", e);
  }
}
