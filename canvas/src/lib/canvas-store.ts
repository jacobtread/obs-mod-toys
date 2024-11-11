import { tweened, type Tweened } from "svelte/motion";
import { writable, type Writable } from "svelte/store";

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
  RequestObjects = "RequestObjects",
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
  | ({ type: ClientMessageType.Authenticate } & ClientMessageAuthenticate)
  | { type: ClientMessageType.RequestObjects };

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

export const canvasState: Writable<CanvasState> = writable({
  objects: [],
});

let socketStore: WebSocket | null = null;

function createWebsocket(): WebSocket {
  const socket = new WebSocket("ws://localhost:3000/ws");
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
  document.body.innerText = e;
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

  sendSocketMessage({
    type: ClientMessageType.RequestObjects,
  });
}

function handleServerError(msg: ServerMessageError) {
  console.error("error response", msg.message);
}

function handleObjects(msg: ServerMessageObjects) {
  canvasState.update((canvasState) => ({
    ...canvasState,
    objects: msg.objects.map((object) => ({
      id: object.id,
      localPosition: tweened(object.object.position),
      object: object.object.object,
      remotePosition: object.object.position,
    })),
  }));
}

function randomUUID(): string {
  // TODO: Polyfill
  return self.crypto.randomUUID();
}

export function createObject(object: Object, initial_position: Position) {
  const id = randomUUID();

  createObjectLocal(id, object, initial_position);

  sendServerAction({
    type: ObjectServerActionType.CreateObject,
    id,
    object,
    initial_position,
  });
}
export function createObjectLocal(
  id: string,
  object: Object,
  initial_position: Position
) {
  canvasState.update((canvasState) => ({
    ...canvasState,
    objects: [
      ...canvasState.objects,
      {
        id,
        object,
        remotePosition: initial_position,
        localPosition: tweened(initial_position),
      },
    ],
  }));
}

export function moveObject(
  data: ObjectServerActionMoveObject,
  immediate: boolean = false
) {
  moveObjectLocal(data, immediate);

  sendServerAction({
    type: ObjectServerActionType.MoveObject,
    id: data.id,
    position: data.position,
  });
}

export function moveObjectLocal(
  data: ObjectServerActionMoveObject,
  immediate: boolean = false
) {
  canvasState.update((canvasState) => {
    return {
      ...canvasState,
      objects: canvasState.objects.map((object) => {
        if (object.id === data.id) {
          object.localPosition.set(
            data.position,
            immediate
              ? { delay: 0, duration: 0 }
              : {
                  delay: 0,
                  duration: 100,
                }
          );
          return {
            ...object,
            remotePosition: data.position,
            localPosition: object.localPosition,
          };
        } else {
          return object;
        }
      }),
    };
  });
}

export function removeObject(data: ObjectServerActionRemoveObject) {
  removeObjectLocal(data);

  sendServerAction({
    type: ObjectServerActionType.RemoveObject,
    id: data.id,
  });
}
export function removeObjectLocal(data: ObjectServerActionRemoveObject) {
  canvasState.update((canvasState) => ({
    ...canvasState,
    objects: canvasState.objects.filter((object) => object.id !== data.id),
  }));
}

export function clearObjects() {
  clearObjectsLocal();

  sendServerAction({
    type: ObjectServerActionType.ClearObjects,
  });
}

export function clearObjectsLocal() {
  canvasState.update((canvasState) => ({
    ...canvasState,
    objects: [],
  }));
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
