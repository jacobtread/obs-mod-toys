use std::{collections::HashMap, sync::Arc};

use axum::{
    body::Bytes,
    extract::{
        ws::{self, WebSocket},
        WebSocketUpgrade,
    },
    response::Response,
    routing::get,
    Extension, Router,
};
use serde::{Deserialize, Serialize};
use tokio::{
    select,
    sync::{broadcast, mpsc},
};
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let (object_server, object_server_handle) = ObjectServer::new();
    tokio::spawn(object_server.run());

    let app = Router::new()
        .route("/ws", get(handler))
        .layer(Extension(object_server_handle.clone()));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}

async fn handler(
    Extension(object_server_handle): Extension<ObjectServerHandle>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, object_server_handle))
}

async fn handle_socket(mut socket: WebSocket, mut object_server_handle: ObjectServerHandle) {
    let mut socket_state = WebSocketState {
        authenticated: false,
        session_id: Uuid::new_v4(),
    };

    loop {
        select! {
            msg = socket.recv() => {

                let msg = match msg {
                    Some(Ok(msg))=> msg,
                    _ => return,
                };

                if let Err(_err) = handle_socket_msg(&mut socket, &mut socket_state, &object_server_handle, msg).await {
                    return;
                }
            },

            broadcast_msg = object_server_handle.rx.recv() => {
                if let Ok(broadcast_msg) = broadcast_msg {
                    if let Err(_err) = handle_socket_broadcast(&mut socket, &mut socket_state, broadcast_msg).await {
                        return;
                    }
                }
            }
        }
    }
}

pub struct WebSocketState {
    session_id: Uuid,
    authenticated: bool,
}

async fn handle_socket_msg(
    socket: &mut WebSocket,
    socket_state: &mut WebSocketState,
    object_server_handle: &ObjectServerHandle,
    msg: axum::extract::ws::Message,
) -> anyhow::Result<()> {
    let msg: WebsocketClientMessage = match msg {
        axum::extract::ws::Message::Text(value) => serde_json::from_str(&value)?,
        axum::extract::ws::Message::Binary(value) => serde_json::from_slice(&value)?,
        _ => return Ok(()),
    };

    match msg {
        WebsocketClientMessage::Authenticate {
            username: _username,
            password: _password,
        } => {
            socket_state.authenticated = true;

            let msg = serde_json::to_string(&WebsocketServerMessage::Authenticated)?;
            socket.send(ws::Message::Text(msg)).await?;

            // TODO: perform authentication
        }
        WebsocketClientMessage::ServerAction(object_server_action) => {
            if !socket_state.authenticated {
                let msg = serde_json::to_string(&WebsocketServerMessage::Error {
                    message: "not authenticated".to_string(),
                })?;
                socket.send(ws::Message::Text(msg)).await?;
                return Ok(());
            }

            _ = object_server_handle.tx.send(ObjectServerMessage::Action {
                session_id: socket_state.session_id,
                action: object_server_action,
            });
        }
    }

    Ok(())
}

async fn handle_socket_broadcast(
    socket: &mut WebSocket,
    socket_state: &mut WebSocketState,
    msg: BroadcastMessage,
) -> anyhow::Result<()> {
    match msg {
        BroadcastMessage::ServerActionReported { session_id, action } => {
            // Don't report self actions
            if socket_state.session_id == session_id {
                return Ok(());
            }

            let msg = serde_json::to_string(&WebsocketServerMessage::ServerActionReported(action))?;
            socket.send(ws::Message::Text(msg)).await?;
        }
        BroadcastMessage::Objects(objects) => {
            let msg = serde_json::to_string(&WebsocketServerMessage::Objects(objects))?;
            socket.send(ws::Message::Text(msg)).await?;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebsocketServerMessage {
    // User is authenticated
    Authenticated,

    Error { message: String },

    // Server reporting an action to a client
    ServerActionReported(ObjectServerAction),

    // Server reporting entire collection of objects and
    // their current state
    Objects(Vec<DefinedObjectWithId>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebsocketClientMessage {
    Authenticate { username: String, password: String },
    // Report an action to the server
    ServerAction(ObjectServerAction),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObjectServerAction {
    // Create a new object
    CreateObject {
        object: Object,
        initial_position: Position,
    },

    // Move an existing object
    MoveObject {
        // ID of the object to move
        id: Uuid,
        // New position of the object
        position: Position,
    },

    // Remove a specific object
    RemoveObject {
        // ID of the object to remove
        id: Uuid,
    },

    // Clear all objects
    ClearObjects,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BroadcastMessage {
    // Reporting an action that occurred
    ServerActionReported {
        session_id: Uuid,
        action: ObjectServerAction,
    },

    // Server reporting entire collection of objects and
    // their current state
    Objects(Vec<DefinedObjectWithId>),
}

#[derive(Debug, Clone)]
pub enum ObjectServerMessage {
    // Action from a client has been performed
    Action {
        session_id: Uuid,
        action: ObjectServerAction,
    },

    // Report the current list of objects to all clients
    ReportObjects,
}

pub struct ObjectServer {
    // Sender for broadcasting messages to websocket clients
    tx: broadcast::Sender<BroadcastMessage>,
    // Receiver for messages to the server
    rx: mpsc::Receiver<ObjectServerMessage>,
    // Store for the objects
    object_store: ObjectStore,
}

pub struct ObjectServerHandle {
    tx: mpsc::Sender<ObjectServerMessage>,
    rx: broadcast::Receiver<BroadcastMessage>,
}

impl Clone for ObjectServerHandle {
    fn clone(&self) -> Self {
        Self {
            tx: self.tx.clone(),
            rx: self.rx.resubscribe(),
        }
    }
}

impl ObjectServer {
    pub fn new() -> (Self, ObjectServerHandle) {
        let (tx_msg, rx_msg) = mpsc::channel(50);
        let (tx_broad, rx_broad) = broadcast::channel(10);

        let handle = ObjectServerHandle {
            tx: tx_msg,
            rx: rx_broad,
        };

        let object_store = ObjectStore::default();

        let server = ObjectServer {
            rx: rx_msg,
            tx: tx_broad,
            object_store,
        };

        (server, handle)
    }

    pub async fn run(mut self) {
        while let Some(message) = self.rx.recv().await {
            match message {
                ObjectServerMessage::Action { session_id, action } => {
                    self.handle_server_action(session_id, action)
                }
                ObjectServerMessage::ReportObjects => {
                    let objects = self.object_store.to_vec();

                    _ = self.tx.send(BroadcastMessage::Objects(objects));
                }
            }
        }
    }

    pub fn handle_server_action(&mut self, session_id: Uuid, action: ObjectServerAction) {
        match &action {
            ObjectServerAction::CreateObject {
                object,
                initial_position,
            } => {
                let object_id = Uuid::new_v4();

                self.object_store.objects.insert(
                    object_id,
                    DefinedObject {
                        object: object.clone(),
                        position: *initial_position,
                    },
                );
            }
            ObjectServerAction::MoveObject { id, position } => {
                if let Some(object) = self.object_store.objects.get_mut(id) {
                    object.position = *position;
                }
            }
            ObjectServerAction::RemoveObject { id } => {
                self.object_store.objects.remove(id);
            }
            ObjectServerAction::ClearObjects => {
                self.object_store.objects.clear();
            }
        }

        _ = self
            .tx
            .send(BroadcastMessage::ServerActionReported { session_id, action });
    }
}

#[derive(Default)]
pub struct ObjectStore {
    objects: HashMap<Uuid, DefinedObject>,
}

impl ObjectStore {
    pub fn to_vec(&self) -> Vec<DefinedObjectWithId> {
        self.objects
            .iter()
            .map(|(key, value)| DefinedObjectWithId {
                id: *key,
                object: value.clone(),
            })
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Object {
    // Text on the canvas
    Text(TextObject),
    // Image on the canvas
    Image(ImageObject),
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
    x: u32,
    y: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextObject {
    // Text content
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageObject {
    // base64 encoded image data
    data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefinedObject {
    position: Position,
    object: Object,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefinedObjectWithId {
    id: Uuid,
    object: DefinedObject,
}
