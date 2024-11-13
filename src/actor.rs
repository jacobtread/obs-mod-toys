use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, mpsc, oneshot};
use uuid::Uuid;

use crate::object::{DefinedObject, DefinedObjectWithId, Object, ObjectStore, Position};

#[derive(Debug, Clone)]
pub enum BroadcastMessage {
    // Reporting an action that occurred
    ServerActionReported {
        session_id: Uuid,
        action: ObjectServerAction,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ObjectServerAction {
    // Create a new object
    CreateObject {
        // ID of the object to create
        id: Uuid,
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

#[derive(Debug)]
pub enum ObjectServerMessage {
    // Action from a client has been performed
    Action {
        session_id: Uuid,
        action: ObjectServerAction,
    },

    // Request the list of objects
    RequestObjects {
        tx: oneshot::Sender<Vec<DefinedObjectWithId>>,
    },
}

pub struct ObjectsActor {
    // Sender for broadcasting messages to websocket clients
    tx: broadcast::Sender<BroadcastMessage>,
    // Receiver for messages to the server
    rx: mpsc::Receiver<ObjectServerMessage>,
    // Store for the objects
    object_store: ObjectStore,
}

pub struct ObjectsActorHandle {
    pub tx: mpsc::Sender<ObjectServerMessage>,
    pub rx: broadcast::Receiver<BroadcastMessage>,
}

impl Clone for ObjectsActorHandle {
    fn clone(&self) -> Self {
        Self {
            tx: self.tx.clone(),
            rx: self.rx.resubscribe(),
        }
    }
}

impl ObjectsActor {
    pub fn create() -> ObjectsActorHandle {
        let (tx_msg, rx_msg) = mpsc::channel(50);
        let (tx_broad, rx_broad) = broadcast::channel(10);

        let handle = ObjectsActorHandle {
            tx: tx_msg,
            rx: rx_broad,
        };

        let object_store = ObjectStore::default();

        let server = ObjectsActor {
            rx: rx_msg,
            tx: tx_broad,
            object_store,
        };

        tokio::spawn(server.run());

        handle
    }

    async fn run(mut self) {
        while let Some(message) = self.rx.recv().await {
            match message {
                ObjectServerMessage::Action { session_id, action } => {
                    self.handle_server_action(session_id, action)
                }
                ObjectServerMessage::RequestObjects { tx } => {
                    let objects = self.object_store.to_vec();
                    _ = tx.send(objects);
                }
            }
        }
    }

    fn handle_server_action(&mut self, session_id: Uuid, action: ObjectServerAction) {
        match &action {
            ObjectServerAction::CreateObject {
                id,
                object,
                initial_position,
            } => {
                self.object_store.objects.insert(
                    *id,
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
