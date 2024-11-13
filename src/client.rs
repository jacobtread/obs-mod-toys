use axum::extract::ws::{self, WebSocket};
use serde::{Deserialize, Serialize};
use tokio::{select, sync::oneshot};
use uuid::Uuid;

use crate::{
    actor::{BroadcastMessage, ObjectServerAction, ObjectServerMessage, ObjectsActorHandle},
    object::DefinedObjectWithId,
};

pub async fn handle_socket(mut socket: WebSocket, mut object_server_handle: ObjectsActorHandle) {
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
    object_server_handle: &ObjectsActorHandle,
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
        WebsocketClientMessage::ServerAction { action } => {
            if !socket_state.authenticated {
                let msg = serde_json::to_string(&WebsocketServerMessage::Error {
                    message: "not authenticated".to_string(),
                })?;
                socket.send(ws::Message::Text(msg)).await?;
                return Ok(());
            }

            _ = object_server_handle
                .tx
                .send(ObjectServerMessage::Action {
                    session_id: socket_state.session_id,
                    action,
                })
                .await;
        }
        WebsocketClientMessage::RequestObjects => {
            let (tx, rx) = oneshot::channel();
            object_server_handle
                .tx
                .send(ObjectServerMessage::RequestObjects { tx })
                .await?;
            let objects = rx.await?;
            let msg = serde_json::to_string(&WebsocketServerMessage::Objects { objects })?;
            socket.send(ws::Message::Text(msg)).await?;
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

            let msg =
                serde_json::to_string(&WebsocketServerMessage::ServerActionReported { action })?;
            socket.send(ws::Message::Text(msg)).await?;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebsocketServerMessage {
    // User is authenticated
    Authenticated,

    Error { message: String },

    // Server reporting an action to a client
    ServerActionReported { action: ObjectServerAction },

    // Server reporting entire collection of objects and
    // their current state
    Objects { objects: Vec<DefinedObjectWithId> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebsocketClientMessage {
    Authenticate { username: String, password: String },
    // Report an action to the server
    ServerAction { action: ObjectServerAction },

    // Request the list of objects
    RequestObjects,
}
