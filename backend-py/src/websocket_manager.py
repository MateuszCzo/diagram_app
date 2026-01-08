from databases import Database
from fastapi import WebSocket, WebSocketDisconnect
from .models import projects
import json
import logging

rooms: dict[str, set[WebSocket]] = {}
project_cache: dict[str, dict] = {}


async def connect_websocket(
    websocket: WebSocket,
    project_id: str,
    database: Database
):
    global rooms, project_cache

    await websocket.accept()

    rooms.setdefault(project_id, set()).add(websocket)
    logging.info(
        f"Klient połączony | projekt={project_id} | "
        f"aktywnych={len(rooms[project_id])}"
    )

    if project_id not in project_cache:
        row = await database.fetch_one(
            projects.select().where(projects.c.id == project_id)
        )

        if row and row["snapshot"]:
            project_cache[project_id] = json.loads(row["snapshot"])
            logging.info("Snapshot załadowany z DB")
        else:
            project_cache[project_id] = {"elements": []}
            logging.info("Nowy pusty projekt")

    await websocket.send_text(
        json.dumps(project_cache[project_id])
    )
    logging.info("Snapshot wysłany do nowego klienta")


async def handle_messages(
    websocket: WebSocket,
    project_id: str,
    database: Database
):
    global rooms, project_cache

    try:
        while True:
            raw = await websocket.receive_text()
            logging.info(f"Dane od klienta | projekt={project_id}")

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                logging.info("Niepoprawny JSON – ignoruję")
                continue

            elements = payload.get("elements")
            if not isinstance(elements, list):
                logging.info("Brak elements[] – ignoruję")
                continue

            project_cache[project_id] = {"elements": elements}
            logging.info(f"RAM update | elements={len(elements)}")

            for conn in rooms.get(project_id, set()):
                if conn != websocket:
                    await conn.send_text(json.dumps(project_cache[project_id]))

            await database.execute(
                projects.update()
                .where(projects.c.id == project_id)
                .values(snapshot=json.dumps(project_cache[project_id]))
            )

            logging.info("Snapshot zapisany do DB")

    except WebSocketDisconnect:
        rooms.get(project_id, set()).discard(websocket)
        logging.info(
            f"Klient rozłączony | projekt={project_id} | "
            f"pozostało={len(rooms.get(project_id, []))}"
        )

        if project_id in rooms and not rooms[project_id]:
            del rooms[project_id]
            logging.info(f"Projekt {project_id} usunięty z rooms")
