from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.db import database
from src.routes import router

from contextlib import asynccontextmanager
from fastapi import FastAPI
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP: połączenie z bazą
    logging.info("Łączenie z bazą danych...")
    await database.connect()
    logging.info("Połączenie z bazą danych powiodło się")

    yield  # tutaj FastAPI startuje

    # SHUTDOWN: rozłączenie
    await database.disconnect()
    logging.info("Serwer się wyłącza")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
