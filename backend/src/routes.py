from fastapi import APIRouter, WebSocket
from .db import database
from .websocket_manager import connect_websocket, handle_messages

router = APIRouter()

@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await connect_websocket(websocket, project_id, database)
    await handle_messages(websocket, project_id, database)
