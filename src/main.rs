use actor::{ObjectsActor, ObjectsActorHandle};
use axum::{extract::WebSocketUpgrade, response::Response, routing::get, Extension, Router};
use client::handle_socket;
use tower_http::cors::CorsLayer;

mod actor;
mod client;
mod object;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let object_server_handle = ObjectsActor::create();

    let app = Router::new()
        .route("/ws", get(handle_ws))
        .layer(Extension(object_server_handle.clone()))
        .layer(CorsLayer::very_permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}

async fn handle_ws(
    Extension(object_server_handle): Extension<ObjectsActorHandle>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, object_server_handle))
}
