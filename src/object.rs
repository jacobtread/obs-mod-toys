use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Default)]
pub struct ObjectStore {
    pub objects: HashMap<Uuid, DefinedObject>,
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
#[serde(tag = "type")]
pub enum Object {
    // Text on the canvas
    Text(TextObject),
    // Image on the canvas
    Image(ImageObject),
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextObject {
    // Text content
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageObject {
    pub url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefinedObject {
    pub position: Position,
    pub object: Object,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefinedObjectWithId {
    pub id: Uuid,
    pub object: DefinedObject,
}
